#!/usr/bin/env node
/**
 * AUTO-APPLY ORCHESTRATOR
 *
 * Runs from cron every 1 hour. Each tick:
 *   1. Load pipeline.md → score → filter ≥ threshold
 *   2. Skip already-submitted, recently-applied-to-same-company
 *   3. Rotate across ATS platforms (Ashby / Greenhouse / Lever)
 *   4. Submit up to APPS_PER_TICK with rate limit between submits
 *   5. Auto-shutdown on 3 consecutive failures
 *   6. Notify Telegram on success / fail / cap-hit / shutdown
 *
 * Daily limits enforced via persistent state in data/.auto-apply-state.json.
 *
 * Exit codes:
 *   0  — normal completion (some or no submissions)
 *   10 — daily cap reached (not an error)
 *   20 — auto-shutdown triggered (3+ consecutive fails)
 *   1  — unexpected error
 *
 * Flags:
 *   --dry      no real submits, just print picks
 *   --once     just attempt 1 application (manual test)
 *   --reset    reset daily counter (e.g., for testing)
 *   --status   print state + exit
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';
import { notify, sendTelegram } from './notify.mjs';

const ROOT = process.cwd();
const STATE_FILE = resolve(ROOT, 'data/.auto-apply-state.json');
const PIPELINE_FILE = resolve(ROOT, 'data/pipeline.md');
const SCAN_HISTORY_FILE = resolve(ROOT, 'data/scan-history.tsv');
mkdirSync(resolve(ROOT, 'data'), { recursive: true });

// ─── Config (env-overridable) ──────────────────────────────────────
const CFG = {
  DAILY_CAP:      Number(process.env.AUTO_APPLY_DAILY_CAP    || 50),
  THRESHOLD:      Number(process.env.AUTO_APPLY_THRESHOLD    || 20),  // title+loc heuristic max ~26
  // Per-ATS rate limit: each platform sees max 1 submit / N minutes from us.
  // ATS systems track velocity per-platform, so we throttle per-ATS not globally.
  // This lets us run 1 Ashby + 1 GH + 1 Lever in parallel within the same tick
  // without any single ATS seeing high velocity. Default 30 min per ATS.
  RATE_LIMIT_PER_ATS_MS: Number(process.env.AUTO_APPLY_RATE_PER_ATS_MS || 30 * 60 * 1000),
  // Small jittered gap between consecutive submits in a tick (anti-thundering-herd
  // when 3 different ATS get hit back-to-back). Default 15s.
  INTER_SUBMIT_GAP_MS:   Number(process.env.AUTO_APPLY_INTER_GAP_MS    || 15 * 1000),
  COMPANY_COOLDOWN_DAYS: Number(process.env.AUTO_APPLY_COMPANY_COOLDOWN || 7),
  FAIL_SHUTDOWN:  Number(process.env.AUTO_APPLY_FAIL_SHUTDOWN || 3),
  APPS_PER_TICK:  Number(process.env.AUTO_APPLY_PER_TICK     || 3),
};
const SUPPORTED_ATS = ['ashby', 'greenhouse', 'lever'];

// ─── CLI flags ─────────────────────────────────────────────────────
const FLAGS = {
  dry:    process.argv.includes('--dry'),
  once:   process.argv.includes('--once'),
  reset:  process.argv.includes('--reset'),
  status: process.argv.includes('--status'),
};

// ─── State ─────────────────────────────────────────────────────────
function todayKey() { return new Date().toISOString().slice(0, 10); }
function loadState() {
  if (!existsSync(STATE_FILE)) return defaultState();
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    // Reset daily counter if new day
    if (s.dailyDate !== todayKey()) {
      s.dailyDate = todayKey();
      s.dailyCount = 0;
      s.dailyFails = 0;
    }
    return { ...defaultState(), ...s };
  } catch { return defaultState(); }
}
function defaultState() {
  return {
    dailyDate: todayKey(),
    dailyCount: 0,
    dailyFails: 0,
    consecutiveFails: 0,
    lastSubmittedAt: 0,                       // kept for diagnostics / legacy
    lastSubmittedAtByAts: {},                 // { ashby: ts, greenhouse: ts, lever: ts }
    submittedJobIds: {},                      // jobId → ISO timestamp
    submittedCompanies: {},                   // company → most-recent ISO timestamp
    lastAts: null,
  };
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Parse pipeline + scan-history for location enrichment ────────
function parsePipeline() {
  if (!existsSync(PIPELINE_FILE)) return [];
  const text = readFileSync(PIPELINE_FILE, 'utf-8');
  // Build URL → {location, firstSeen} from scan-history.tsv
  // col 0 = url, col 1 = first_seen (ISO ts or YYYY-MM-DD), col 6 = location
  const enrichByUrl = new Map();
  if (existsSync(SCAN_HISTORY_FILE)) {
    const histLines = readFileSync(SCAN_HISTORY_FILE, 'utf-8').split('\n').slice(1);
    for (const line of histLines) {
      const cols = line.split('\t');
      if (cols.length >= 7) {
        // Keep latest entry per URL (in case of dupes)
        enrichByUrl.set(cols[0], { firstSeen: cols[1], location: cols[6] });
      }
    }
  }
  const out = [];
  for (const m of text.matchAll(/^- \[ \] (\S+)\s*\|\s*([^|]+)\|\s*(.+)$/gm)) {
    const url = m[1].trim();
    const company = m[2].trim();
    const title = m[3].trim();
    const enrich = enrichByUrl.get(url) || {};
    const location = enrich.location || '';
    const firstSeenMs = enrich.firstSeen ? new Date(enrich.firstSeen).getTime() : 0;
    const ats = detectAts(url);
    if (!ats) continue;
    const jobId = jobIdFromUrl(url, ats);
    if (!jobId) continue;
    out.push({ url, company, title, location, firstSeenMs, ats, jobId });
  }
  return out;
}

function detectAts(url) {
  if (/jobs\.ashbyhq\.com/.test(url)) return 'ashby';
  if (/(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io/.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co/.test(url)) return 'lever';
  return null;
}
function jobIdFromUrl(url, ats) {
  if (ats === 'ashby')      return url.match(/jobs\.ashbyhq\.com\/[^/]+\/([\w-]+)/)?.[1];
  if (ats === 'greenhouse') return url.match(/jobs\/(\d+)/)?.[1];
  if (ats === 'lever')      return url.match(/jobs\.lever\.co\/[^/]+\/([\w-]+)/)?.[1];
  return null;
}

// ─── Scoring (heuristic, port from tmp/heuristic-rank.mjs) ─────────
const POS = [
  [/\bdata scientist\b/i, 8], [/\bdata engineer\b/i, 5], [/\banalytics engineer\b/i, 5],
  [/\b(machine learning|ML)\b/i, 5], [/\bNLP\b/i, 5], [/\bLLM\b/i, 4],
  [/\b(credit|fintech|lending|banking)\b/i, 6],
  [/\b(A\/B test|experimentation)\b/i, 5], [/\bcausal\b/i, 4], [/\battribution\b/i, 5],
  [/\b(segmentation|cluster)\b/i, 4], [/\b(churn|retention|expansion)\b/i, 4],
  [/\b(intent scoring|lead scoring|customer health)\b/i, 5], [/\bcommercial\b/i, 4],
  [/\b(marketing|growth|GTM|RevOps)\b/i, 4], [/\bsenior\b/i, 3],
  [/\bremote\b/i, 3], [/\b(europe|EU|EMEA|UK)\b/i, 3],
];
const NEG = [
  [/\b(computer vision|image|video|3D)\b/i, -3], [/\b(autonomous|self-driving)\b/i, -4],
  [/\bPhD (required|preferred|essential)\b/i, -3], [/\b(10\+|15\+)\s*years\b/i, -3],
  [/\b(speech|audio|voice|TTS|ASR)\b/i, -3], [/\b(staff\s+engineer|principal engineer)\b/i, -2],
  [/\b(reinforcement learning|RLHF)\b/i, -2], [/\b(security clearance|polygraph)\b/i, -10],
];
const LOC_BONUS = [
  [/anywhere|worldwide|global|remote-first|fully remote/i, 8],
  [/europe|EU|EMEA|EEA/i, 5],
  [/united kingdom|UK|england|london/i, 4],
  [/remote/i, 3],
  [/germany|berlin|munich|france|paris|netherlands|amsterdam|spain|sweden|stockholm|ireland|dublin/i, 3],
  [/USA only|US only|remote.*united states/i, -8],
  [/india|bangalore|bengaluru/i, -3],
];
function score(title, location = '', firstSeenMs = 0) {
  let s = 0;
  for (const [re, w] of POS) if (re.test(title)) s += w;
  for (const [re, w] of NEG) if (re.test(title)) s += w;
  // Title-level role bonuses
  if (/\bsenior\s+data\s+scientist\b/i.test(title)) s += 5;
  if (/\bsenior\s+(machine learning|ML)\s+engineer\b/i.test(title)) s += 4;
  if (/\bdata scientist\b/i.test(title) && !/^(staff|principal|head)/i.test(title)) s += 3;
  // Location bonus
  for (const [re, w] of LOC_BONUS) if (re.test(location)) s += w;
  // Freshness bonus — heavy priority on jobs posted in the last hour, taper off after.
  // 0 = unknown (legacy date-only rows or missing scan-history entry) → no bonus, no penalty.
  if (firstSeenMs > 0) {
    const ageMs = Date.now() - firstSeenMs;
    const oneHour = 3600 * 1000;
    if (ageMs <= oneHour)             s += 20; // freshest — top priority
    else if (ageMs <= 6 * oneHour)    s += 10;
    else if (ageMs <= 24 * oneHour)   s += 5;
    else if (ageMs <= 7 * 24 * oneHour) s += 0;  // still in pool, no bonus
    else                              s -= 3;   // older than a week, mild penalty
  }
  return s;
}

// ─── Filter pipeline → ranked candidates ───────────────────────────
function loadSkiplistSet() {
  const p = resolve(ROOT, 'data/skiplist.txt');
  if (!existsSync(p)) return new Set();
  return new Set(
    readFileSync(p, 'utf-8').split('\n')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Hard filter: reject US-located roles. User has UK Graduate Visa + EU residence —
// no US work authorisation, so US-based listings will always fail at the
// "Are you authorized to work in the US?" required question.
const US_LOCATION_BLOCK = /\b(united states|^USA?$|, US$|san francisco|bay area|new york|nyc|boston|seattle|austin|chicago|los angeles|denver|san diego|washington.?d\.?c\.?|california|texas|massachusetts|menlo park|palo alto|mountain view|sunnyvale|santa clara)\b/i;

function buildCandidates(state) {
  const all = parsePipeline();
  const cooldownMs = CFG.COMPANY_COOLDOWN_DAYS * 24 * 3600 * 1000;
  const now = Date.now();
  const skiplist = loadSkiplistSet();

  const candidates = all
    .filter(c => !state.submittedJobIds[c.jobId])  // not already submitted
    .filter(c => !skiplist.has(c.company.toLowerCase()))  // user skiplist (bot /skip)
    .filter(c => !US_LOCATION_BLOCK.test(c.location || ''))  // no US visa → skip US roles
    .filter(c => {
      const last = state.submittedCompanies[c.company];
      if (!last) return true;
      return (now - new Date(last).getTime()) > cooldownMs;
    })
    .map(c => ({
      ...c,
      score: score(c.title, c.location, c.firstSeenMs),
      freshness: freshnessTier(c.firstSeenMs),
    }))
    .filter(c => c.score >= CFG.THRESHOLD);

  // Block obvious title types
  const BLOCK_TITLE = /\b(junior|intern|apprentice|graduate program|trainee|new grad|head of|VP\b|director\b|CTO|chief|account executive|business development|customer success manager|sales (engineer|trainer)|solutions consultant|government|defence|defense)\b/i;
  const filtered = candidates.filter(c => !BLOCK_TITLE.test(c.title));

  // Two-tier sort: freshness bucket first (newer always wins), then score within bucket.
  filtered.sort((a, b) => (b.freshness - a.freshness) || (b.score - a.score));
  return filtered;
}

// 5=≤1h, 4=≤6h, 3=≤24h, 2=≤7d, 1=older, 0=unknown (treated as old-ish)
function freshnessTier(firstSeenMs) {
  if (!firstSeenMs) return 0;
  const ageH = (Date.now() - firstSeenMs) / 3600000;
  if (ageH <= 1)   return 5;
  if (ageH <= 6)   return 4;
  if (ageH <= 24)  return 3;
  if (ageH <= 168) return 2;
  return 1;
}

// ─── Round-robin ATS picker ────────────────────────────────────────
function pickByRotation(candidates, lastAts) {
  if (!candidates.length) return [];
  const byAts = {};
  for (const c of candidates) {
    (byAts[c.ats] = byAts[c.ats] || []).push(c);
  }
  const atsList = SUPPORTED_ATS.filter(a => byAts[a]?.length);
  if (!atsList.length) return candidates;
  // Start at the ATS AFTER lastAts (round-robin)
  let startIdx = lastAts ? (atsList.indexOf(lastAts) + 1) % atsList.length : 0;
  if (startIdx < 0) startIdx = 0;
  const rotated = [...atsList.slice(startIdx), ...atsList.slice(0, startIdx)];
  // Interleave: 1 from each ATS in rotated order, then repeat
  const out = [];
  let i = 0;
  while (out.length < candidates.length) {
    let added = false;
    for (const a of rotated) {
      const next = byAts[a]?.[i];
      if (next) { out.push(next); added = true; }
    }
    if (!added) break;
    i++;
  }
  return out;
}

// ─── Submit single via apply.mjs subprocess ────────────────────────
//   exit 0 — submitted successfully
//   exit 5 — soft-skip (missing required fields the bot can't answer)
//   exit *  — technical failure (Playwright timeout, ATS API error, etc.)
function submitJob(url) {
  return new Promise((resolveP) => {
    const args = ['auto/apply.mjs', url, '--submit'];
    const p = spawn('node', args, { cwd: ROOT, env: process.env });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => p.kill('SIGTERM'), 8 * 60_000);
    p.stdout.on('data', d => (stdout += d.toString()));
    p.stderr.on('data', d => (stderr += d.toString()));
    p.on('close', (code) => {
      clearTimeout(timer);
      const tailLines = (stdout + stderr).split('\n').slice(-20).join('\n');
      const success = /✅ Submitted:/.test(stdout);
      const skipped = code === 5;
      const reason = skipped
        ? 'skipped — missing required fields (add qa_hints)'
        : /⚠ Submitted but no success indicator/.test(stdout)
          ? 'no success indicator (form may have rejected)'
          : code !== 0 ? `exit ${code}` : null;
      resolveP({ success, skipped, code, tail: tailLines, reason });
    });
  });
}

// ─── Sleep helper with jitter ──────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(ms, pct = 0.2) { return ms + Math.floor((Math.random() - 0.5) * 2 * ms * pct); }

// ─── Main tick ─────────────────────────────────────────────────────
async function tick() {
  const state = loadState();

  if (FLAGS.reset) {
    state.dailyCount = 0;
    state.dailyFails = 0;
    state.consecutiveFails = 0;
    saveState(state);
    console.log('State reset.');
    return 0;
  }

  if (FLAGS.status) {
    console.log(JSON.stringify(state, null, 2));
    return 0;
  }

  // Pause flag — toggled by the bot's /pause and /resume commands.
  const PAUSE_FILE = resolve(ROOT, 'data/.pause');
  if (existsSync(PAUSE_FILE)) {
    console.log('⏸  Paused via data/.pause flag — skipping tick. Run /resume in bot to clear. submitted 0 / daily ' + state.dailyCount + '/' + CFG.DAILY_CAP);
    return 0;
  }

  console.log(`━━━ auto-apply tick · ${new Date().toISOString()} ━━━`);
  console.log(`Config: cap=${CFG.DAILY_CAP}, threshold=${CFG.THRESHOLD}, rate=${CFG.RATE_LIMIT_MS / 1000}s, per-tick=${CFG.APPS_PER_TICK}`);
  console.log(`State:  today=${state.dailyDate}, dailyCount=${state.dailyCount}/${CFG.DAILY_CAP}, fails=${state.consecutiveFails}, lastAts=${state.lastAts || 'none'}`);

  // Guard: daily cap
  if (state.dailyCount >= CFG.DAILY_CAP) {
    console.log(`Daily cap reached (${state.dailyCount}). Exit.`);
    return 10;
  }

  // Guard: shutdown
  if (state.consecutiveFails >= CFG.FAIL_SHUTDOWN) {
    console.log(`Shutdown: ${state.consecutiveFails} consecutive fails. Reset manually with --reset.`);
    return 20;
  }

  // Build & rotate
  const candidates = buildCandidates(state);
  console.log(`Candidates: ${candidates.length} (after filter & cooldown)`);
  if (!candidates.length) {
    console.log('Nothing to submit. submitted 0 / daily ' + state.dailyCount + '/' + CFG.DAILY_CAP);
    return 0;
  }
  const rotated = pickByRotation(candidates, state.lastAts);

  const limit = FLAGS.once ? 1 : Math.min(CFG.APPS_PER_TICK, CFG.DAILY_CAP - state.dailyCount);
  console.log(`Will attempt: ${limit}`);

  let submittedThisTick = 0;
  let failedThisTick = 0;
  const companiesThisTick = new Set();

  for (const c of rotated) {
    if (submittedThisTick >= limit) break;
    // Per-tick per-company cap = 1 (avoid burning quotas like Faculty 3-per-90d)
    if (companiesThisTick.has(c.company)) {
      console.log(`  ⏭ skip ${c.company} — already attempted this tick`);
      continue;
    }
    companiesThisTick.add(c.company);

    // Rate limit PER-ATS (each platform has its own cooldown). This is what
    // ATS systems actually track — per-account/IP velocity to their platform,
    // not your overall submit rate across the internet.
    const lastForThisAts = (state.lastSubmittedAtByAts || {})[c.ats] || 0;
    if (lastForThisAts) {
      const wait = lastForThisAts + CFG.RATE_LIMIT_PER_ATS_MS - Date.now();
      if (wait > 0) {
        const min = (wait / 60000).toFixed(1);
        console.log(`  ⏭ skip ${c.ats} — cooldown ${min} min left on this ATS`);
        continue;
      }
    }
    // Small inter-submit gap regardless of ATS (anti-thundering-herd)
    if (state.lastSubmittedAt && submittedThisTick + failedThisTick > 0) {
      const gap = CFG.INTER_SUBMIT_GAP_MS;
      console.log(`  ⏳ inter-submit gap ${(gap / 1000).toFixed(0)}s...`);
      await sleep(jitter(gap));
    }

    const ageLabel = c.firstSeenMs
      ? (() => {
          const h = (Date.now() - c.firstSeenMs) / 3600000;
          if (h <= 1)   return '🔥<1h';
          if (h <= 6)   return `${h.toFixed(1)}h`;
          if (h <= 24)  return `${h.toFixed(0)}h`;
          if (h <= 168) return `${(h / 24).toFixed(0)}d`;
          return `${(h / 24).toFixed(0)}d`;
        })()
      : 'age?';
    console.log(`\n▶ [${c.ats}] ${c.company} — ${c.title} (score ${c.score}, ${ageLabel})`);
    console.log(`  ${c.url}`);

    if (FLAGS.dry) {
      console.log('  DRY — would submit');
      submittedThisTick++;
      state.dailyCount++;
      continue;
    }

    const t0 = Date.now();
    const result = await submitJob(c.url);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
    const statusIcon = result.success ? '✅ SUBMITTED' : result.skipped ? '⏭ SKIPPED' : '⚠ FAILED';
    console.log(`  → ${statusIcon} (${elapsed}s)${result.reason ? `: ${result.reason}` : ''}`);

    state.lastSubmittedAt = Date.now();
    state.lastAts = c.ats;
    state.lastSubmittedAtByAts = state.lastSubmittedAtByAts || {};
    state.lastSubmittedAtByAts[c.ats] = Date.now();
    state.submittedJobIds[c.jobId] = new Date().toISOString();
    if (result.success) {
      state.submittedCompanies[c.company] = new Date().toISOString();
    }
    saveState(state);

    if (result.success) {
      state.consecutiveFails = 0;
      state.dailyCount++;
      submittedThisTick++;
      notify.applySuccess(c.company, c.title, `tmp/runs/${todayKey()}/${c.company.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`);
    } else if (result.skipped) {
      // Soft-skip: profile gap, not a technical failure. Do NOT increment consecutiveFails
      // (don't trigger shutdown). Do NOT notify on every skip (spam). Just log.
      // The jobId is still added to submittedJobIds so we don't retry the same job.
    } else {
      state.consecutiveFails++;
      state.dailyFails++;
      failedThisTick++;
      notify.applyFail(c.company, c.title, result.reason || 'unknown');
      if (state.consecutiveFails >= CFG.FAIL_SHUTDOWN) {
        notify.shutdown(`${state.consecutiveFails} consecutive fails. Last: ${c.company}`);
        saveState(state);
        console.log(`Shutdown triggered. submitted ${submittedThisTick} / daily ${state.dailyCount}/${CFG.DAILY_CAP}`);
        return 20;
      }
    }
    saveState(state);
  }

  // Cap notification
  if (state.dailyCount >= CFG.DAILY_CAP) notify.capReached(state.dailyCount);

  console.log(`\nDone. submitted ${submittedThisTick} / daily ${state.dailyCount}/${CFG.DAILY_CAP} (failed ${failedThisTick} this tick)`);
  return 0;
}

tick().then(code => process.exit(code)).catch(e => {
  console.error('Fatal:', e);
  sendTelegram(`🚨 Auto-apply fatal error: ${e.message}`).finally(() => process.exit(1));
});
