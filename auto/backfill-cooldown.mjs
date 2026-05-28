#!/usr/bin/env node
/**
 * One-time backfill: populate submittedCompanies + submittedJobIds in
 * data/.auto-apply-state.json from historical runs that were submitted
 * outside the orchestrator (e.g. manual apply.mjs runs).
 *
 * Without this, the orchestrator's 7-day cooldown gate ignores historical
 * submissions and may re-submit to companies you already applied to.
 *
 * Reads:
 *   - tmp/runs/<date>/<slug>/summary.json (for company name + jobId)
 *   - status.yml or http://localhost:4280/api/status (for stage=submitted)
 *
 * Writes:
 *   - merges into data/.auto-apply-state.json (does NOT clobber existing)
 *
 * Run:
 *   node auto/backfill-cooldown.mjs           # dry run, print plan
 *   node auto/backfill-cooldown.mjs --apply   # write to state file
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = process.cwd();
const RUNS_DIR = resolve(ROOT, 'tmp/runs');
const STATE_FILE = resolve(ROOT, 'data/.auto-apply-state.json');
const APPLY = process.argv.includes('--apply');

function readJSON(p) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; } }

// Load status.yml entries via /api/status (more reliable parse than YAML lib-free)
async function fetchStatusEntries() {
  try {
    const res = await fetch('http://localhost:4280/api/status', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.log(`Warning: dashboard not running, fallback to runs/ scan only (${e.message})`);
    return [];
  }
}

// Scan all run dirs
function scanRuns() {
  if (!existsSync(RUNS_DIR)) return [];
  const found = [];
  for (const date of readdirSync(RUNS_DIR)) {
    const dateDir = join(RUNS_DIR, date);
    if (!statSync(dateDir).isDirectory()) continue;
    for (const slug of readdirSync(dateDir)) {
      const slugDir = join(dateDir, slug);
      if (!statSync(slugDir).isDirectory()) continue;
      const summaryPath = join(slugDir, 'summary.json');
      if (!existsSync(summaryPath)) continue;
      const summary = readJSON(summaryPath);
      if (!summary?.job) continue;
      const hasConfirmation = existsSync(join(slugDir, 'confirmation.png'))
        || existsSync(join(slugDir, 'confirmation.txt'));
      const mtime = statSync(summaryPath).mtimeMs;
      found.push({
        date,
        slug,
        company: summary.job.company,
        ats: summary.job.ats,
        jobId: summary.job.jobId || summary.job.id || null,
        url: summary.job.url || summary.job.applyUrl || null,
        hasConfirmation,
        timestamp: new Date(mtime).toISOString(),
      });
    }
  }
  return found;
}

const statusEntries = await fetchStatusEntries();
const submittedSlugs = new Set(
  statusEntries.filter(e => e.stage === 'submitted').map(e => e.slug)
);

const runs = scanRuns();

// Only backfill if (a) status.yml marks slug as submitted, AND (b) we have summary.json
const backfillCandidates = runs.filter(r => submittedSlugs.has(r.slug) && r.company);

console.log(`─── backfill plan (--apply to write) ───`);
console.log(`Found ${runs.length} run dirs with summary.json`);
console.log(`status.yml has ${submittedSlugs.size} entries marked stage=submitted`);
console.log(`→ ${backfillCandidates.length} slugs to backfill\n`);

const state = readJSON(STATE_FILE) || {
  dailyDate: new Date().toISOString().slice(0, 10),
  dailyCount: 0, dailyFails: 0, consecutiveFails: 0, lastSubmittedAt: 0,
  submittedJobIds: {}, submittedCompanies: {}, lastAts: null,
};

let addedCompanies = 0, addedJobs = 0;
for (const r of backfillCandidates) {
  // Always use the MOST RECENT timestamp per company
  const existing = state.submittedCompanies[r.company];
  if (!existing || new Date(r.timestamp) > new Date(existing)) {
    state.submittedCompanies[r.company] = r.timestamp;
    if (!existing) addedCompanies++;
  }
  if (r.jobId && !state.submittedJobIds[r.jobId]) {
    state.submittedJobIds[r.jobId] = r.timestamp;
    addedJobs++;
  }
  console.log(`  ${r.date}  ${r.company.padEnd(20)} ${r.slug} ${r.hasConfirmation ? '✓conf' : ''}`);
}

console.log(`\nWould add: ${addedCompanies} new companies, ${addedJobs} new jobIds`);
console.log(`Total after merge: ${Object.keys(state.submittedCompanies).length} companies, ${Object.keys(state.submittedJobIds).length} jobIds`);

if (APPLY) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log(`\n✓ Written to ${STATE_FILE}`);
} else {
  console.log(`\n(dry run — pass --apply to write)`);
}
