#!/usr/bin/env node
/**
 * 24/7 scheduler. Long-running process — keeps the career-ops system fresh.
 *
 * Schedule (in-process, no external cron):
 *   - Every 1 h    → regenerate dashboard.html (catches status.yml edits)
 *   - Every 6 h    → scan portals.yml (Ashby/Greenhouse/Lever) + diff vs pipeline
 *   - Every 12 h   → scan LinkedIn (Indonesia + APAC + global remote)
 *   - Every 24 h   → dedup pipeline + compile data/new-jobs-feed.md
 *
 * Run:  node auto/cron.mjs
 * Logs: writes to tmp/cron.log (rotated daily). Stdout also prints summary.
 *
 * Survives single-task failures: any tick error is caught + logged, next tick continues.
 * No external deps (uses setInterval / spawn).
 */
import 'dotenv/config';
import { spawn } from 'child_process';
import { mkdirSync, appendFileSync, readFileSync, writeFileSync, existsSync, renameSync, statSync } from 'fs';
import { resolve } from 'path';

const LOG_FILE = resolve('tmp/cron.log');
const FEED_FILE = resolve('data/new-jobs-feed.md');
mkdirSync(resolve('tmp'), { recursive: true });
mkdirSync(resolve('data'), { recursive: true });

const HOUR = 60 * 60 * 1000;
const SCHEDULE = {
  dashboard:    1 * HOUR,
  portals:      6 * HOUR,
  feed:        24 * HOUR,
  autoApply:    30 * 60 * 1000,  // every 30 min — per-ATS rate limit is what protects against velocity flags now, not tick frequency
  hourlyReport: 1 * HOUR,  // status report → Telegram
};

// Override via env for testing: CRON_DASHBOARD=10000 etc. (milliseconds)
for (const k of ['dashboard', 'portals', 'feed', 'autoApply', 'hourlyReport']) {
  const env = process.env[`CRON_${k.toUpperCase()}`];
  if (env) SCHEDULE[k] = Number(env);
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(line) {
  maybeRotate();
  const msg = `[${ts()}] ${line}`;
  console.log(msg);
  appendFileSync(LOG_FILE, msg + '\n');
}

// Rotate log if > 5 MB (called on each tick log)
function maybeRotate() {
  try {
    if (!existsSync(LOG_FILE)) return;
    if (statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      renameSync(LOG_FILE, LOG_FILE + '.old');
      writeFileSync(LOG_FILE, '');
    }
  } catch {}
}

function runNode(scriptArgs, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolveP) => {
    const p = spawn('node', scriptArgs, { cwd: process.cwd(), env: process.env });
    let out = '', err = '';
    const timer = setTimeout(() => {
      p.kill('SIGTERM');
      err += '\n[TIMEOUT]';
    }, timeoutMs);
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('close', (code) => {
      clearTimeout(timer);
      resolveP({ code, out, err });
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      resolveP({ code: -1, out, err: err + e.message });
    });
  });
}

async function safeTick(name, fn) {
  log(`▶ tick: ${name}`);
  try {
    await fn();
    log(`✓ tick done: ${name}`);
  } catch (e) {
    log(`✗ tick failed: ${name}: ${e.message}`);
  }
}

// ─── Task 1: regenerate dashboard.html ──────────────────────────────
async function tickDashboard() {
  const r = await runNode(['auto/dashboard.mjs'], 60_000);
  if (r.code !== 0) throw new Error(`dashboard exit ${r.code}: ${r.err.slice(0, 200)}`);
  // Pull run count from stdout for log
  const m = r.out.match(/(\d+)\s+runs indexed/);
  log(`  dashboard regen: ${m?.[1] || '?'} runs`);
}

// ─── Task 2: scan portals (Ashby/Greenhouse/Lever) ─────────────────
async function tickPortals() {
  // Snapshot current pipeline size before scan
  const before = pipelineCount();
  const r = await runNode(['scan.mjs'], 5 * 60_000);
  if (r.code !== 0) throw new Error(`scan exit ${r.code}: ${r.err.slice(0, 200)}`);
  const after = pipelineCount();
  log(`  portals scan: pipeline ${before} → ${after} entries (Δ${after - before})`);
}

// ─── Task 3: auto-apply orchestrator ───────────────────────────────
async function tickAutoApply() {
  const r = await runNode(['auto/auto-apply.mjs'], 60 * 60_000);
  // exit 0 = normal; 10 = cap hit; 20 = shutdown
  if (r.code !== 0 && r.code !== 10 && r.code !== 20) {
    throw new Error(`auto-apply exit ${r.code}: ${r.err.slice(0, 200)}`);
  }
  const m = r.out.match(/submitted (\d+) \/ daily (\d+)\/(\d+)/);
  if (m) log(`  auto-apply: +${m[1]} this tick · ${m[2]}/${m[3]} today`);
  else log(`  auto-apply: ${r.out.split('\n').slice(-3).join(' | ').slice(0, 200)}`);
}

// ─── Task 3b: hourly status report → Telegram ──────────────────────
async function tickHourlyReport() {
  const r = await runNode(['auto/hourly-report.mjs'], 30_000);
  if (r.code !== 0) throw new Error(`hourly-report exit ${r.code}: ${r.err.slice(0, 200)}`);
  log(`  hourly-report sent`);
}

// ─── Task 4: compile new-jobs feed ─────────────────────────────────
// Uses data/.seen-urls.txt as the persistent "ever seen" set, so feed truncation
// doesn't cause false-positives on "new".
const SEEN_FILE = resolve('data/.seen-urls.txt');

async function tickFeed() {
  const pipeline = readMaybe(resolve('data/pipeline.md'));
  const linkedin = readMaybe(resolve('data/pipeline-linkedin.md'));
  const seenRaw = readMaybe(SEEN_FILE);
  const seenSet = new Set(seenRaw.split('\n').filter(Boolean));

  const allEntries = [];
  for (const src of [pipeline, linkedin]) {
    for (const m of src.matchAll(/^- \[ \] (\S+)\s*\|\s*([^|]+)\|\s*(.+)$/gm)) {
      allEntries.push({ url: m[1], company: m[2].trim(), title: m[3].trim() });
    }
  }

  // De-dup current entries by URL (within-tick)
  const tickSeen = new Set();
  const unique = allEntries.filter(e => {
    if (tickSeen.has(e.url)) return false;
    tickSeen.add(e.url);
    return true;
  });

  // Compute genuinely new (never seen) vs known
  const newOnes = unique.filter(e => !seenSet.has(e.url));
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // Update persistent seen set
  for (const e of unique) seenSet.add(e.url);
  writeFileSync(SEEN_FILE, [...seenSet].join('\n'));

  const out = [
    `# New Jobs Feed (last updated ${stamp})`,
    ``,
    `**${newOnes.length} genuinely new** since previous tick · ${unique.length} total in pipeline · ${seenSet.size} ever seen`,
    ``,
    `## 🆕 New since last tick (${newOnes.length})`,
    ``,
    ...(newOnes.length === 0 ? ['_(none — nothing new this round)_'] : newOnes.slice(0, 200).map(e => `- [ ] ${e.url} | ${e.company} | ${e.title}`)),
    ``,
    `## All in pipeline (${unique.length})`,
    ``,
    ...unique.slice(0, 500).map(e => `- [ ] ${e.url} | ${e.company} | ${e.title}`),
  ].join('\n');

  writeFileSync(FEED_FILE, out);
  log(`  feed compile: ${newOnes.length} new / ${unique.length} total (${seenSet.size} ever seen)`);
}

// ─── WIB-aligned scheduler (helper kept for future time-anchored job ticks) ──
function scheduleWibTick(name, hour, fn) {
  const now = new Date();
  // Get current time components in Asia/Jakarta (UTC+7)
  const wibParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);

  const get = (type) => parseInt(wibParts.find(p => p.type === type)?.value ?? '0', 10);
  const wibHour = get('hour');
  const wibMin  = get('minute');
  const wibSec  = get('second');

  // Seconds elapsed since midnight WIB
  const elapsedSec = wibHour * 3600 + wibMin * 60 + wibSec;
  const targetSec  = hour * 3600;

  let diffSec = targetSec - elapsedSec;
  if (diffSec <= 0) diffSec += 24 * 3600; // already passed today → fire tomorrow

  const diffMs  = diffSec * 1000;
  const diffMin = Math.round(diffSec / 60);

  log(`  scheduled: ${name} at ${hour}:00 WIB (next fire in ${diffMin} min)`);

  setTimeout(() => {
    safeTick(name, fn);
    setInterval(() => safeTick(name, fn), 24 * HOUR);
  }, diffMs);
}

// ─── helpers ───────────────────────────────────────────────────────
function readMaybe(p) { try { return readFileSync(p, 'utf-8'); } catch { return ''; } }
function pipelineCount() {
  return (readMaybe(resolve('data/pipeline.md')).match(/^- \[ \]/gm) || []).length;
}

// ─── scheduler ─────────────────────────────────────────────────────
function startInterval(name, ms, fn, runImmediately = false, offsetMs = 0) {
  if (runImmediately) safeTick(name, fn);
  if (offsetMs > 0) {
    setTimeout(() => {
      safeTick(name, fn);
      setInterval(() => safeTick(name, fn), ms);
    }, offsetMs);
  } else {
    setInterval(() => safeTick(name, fn), ms);
  }
  log(`  scheduled: ${name} every ${(ms / 60_000).toFixed(1)} min${offsetMs ? ` (offset ${offsetMs / 60_000} min)` : ''}`);
}

log('━━━ career-ops cron started ━━━');
log(`  cwd: ${process.cwd()}`);
log(`  dashboard:    ${SCHEDULE.dashboard / 60_000} min`);
log(`  portals:      ${SCHEDULE.portals / 60_000} min`);
log(`  feed:         ${SCHEDULE.feed / 60_000} min`);
log(`  autoApply:    ${SCHEDULE.autoApply / 60_000} min`);
log(`  hourlyReport: ${SCHEDULE.hourlyReport / 60_000} min`);

startInterval('dashboard',    SCHEDULE.dashboard,    tickDashboard,    true);
startInterval('portals',      SCHEDULE.portals,      tickPortals,      true);
startInterval('feed',         SCHEDULE.feed,         tickFeed,         true);
startInterval('autoApply',    SCHEDULE.autoApply,    tickAutoApply,    false); // delay first tick — let portals scan first
startInterval('hourlyReport', SCHEDULE.hourlyReport, tickHourlyReport, false, 5 * 60 * 1000); // offset 5 min so autoApply finishes first

// Keep alive
process.on('SIGINT', () => { log('SIGINT — exiting'); process.exit(0); });
process.on('SIGTERM', () => { log('SIGTERM — exiting'); process.exit(0); });
process.on('uncaughtException', (e) => log(`⚠ uncaught: ${e.message}`));
process.on('unhandledRejection', (e) => log(`⚠ unhandled: ${e?.message || e}`));
