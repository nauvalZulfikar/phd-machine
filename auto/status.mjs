#!/usr/bin/env node
/**
 * Update status.yml for a run.
 *
 * Usage:
 *   node auto/status.mjs <slug-or-substring> <stage> [--note "..."] [--date YYYY-MM-DD]
 *   node auto/status.mjs --list                                    # list runs + current stage
 *   node auto/status.mjs faculty interview-1 --note "scheduled 22 May"
 *
 * Valid stages:
 *   submitted, viewed, screen, interview-1, interview-2, interview-final,
 *   offer, rejected, withdrawn, ghosted, dry-run
 *
 * Matches the FIRST run whose slug or company-title contains the substring (newest-first).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import yaml from 'js-yaml';

const VALID = ['submitted', 'viewed', 'screen', 'interview-1', 'interview-2', 'interview-final', 'offer', 'rejected', 'withdrawn', 'ghosted', 'dry-run'];
const RUNS = resolve('tmp/runs');

function findRuns(query) {
  if (!existsSync(RUNS)) return [];
  const all = [];
  for (const date of readdirSync(RUNS)) {
    const d = join(RUNS, date);
    if (!statSync(d).isDirectory()) continue;
    for (const slug of readdirSync(d)) {
      const runDir = join(d, slug);
      if (!statSync(runDir).isDirectory()) continue;
      all.push({ date, slug, runDir });
    }
  }
  all.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(r => r.slug.toLowerCase().includes(q));
}

function loadStatus(runDir) {
  const p = join(runDir, 'status.yml');
  if (!existsSync(p)) return { stage: 'unknown', _file: p };
  return { ...yaml.load(readFileSync(p, 'utf-8')), _file: p };
}

function saveStatus(runDir, status) {
  const path = join(runDir, 'status.yml');
  const out = [
    `# Update this file as the application progresses.`,
    `# Valid stages: ${VALID.join(', ')}`,
    `stage: ${status.stage}`,
    `submitted_at: ${status.submitted_at || new Date().toISOString()}`,
    `last_update: ${new Date().toISOString()}`,
    `notes: ${JSON.stringify(status.notes || '')}`,
  ].join('\n');
  writeFileSync(path, out);
}

const args = process.argv.slice(2);

if (args[0] === '--list' || args[0] === '-l' || args.length === 0) {
  const runs = findRuns(args[1] || null);
  if (!runs.length) { console.log('No runs found.'); process.exit(0); }
  console.log(`${runs.length} run(s):\n`);
  for (const r of runs) {
    const s = loadStatus(r.runDir);
    const stage = (s.stage || 'unknown').padEnd(18);
    const updated = String(s.last_update || '').slice(0, 10);
    console.log(`  [${stage}] ${r.date}/${r.slug}${s.notes ? `\n    ↳ ${s.notes}` : ''}${updated ? `  · updated ${updated}` : ''}`);
  }
  process.exit(0);
}

const [query, stage, ...rest] = args;
if (!query || !stage) {
  console.error('Usage: node auto/status.mjs <slug-substring> <stage> [--note "..."]');
  console.error('       node auto/status.mjs --list [filter]');
  process.exit(1);
}

if (!VALID.includes(stage)) {
  console.error(`Invalid stage "${stage}". Valid: ${VALID.join(', ')}`);
  process.exit(1);
}

let note;
const noteIdx = rest.indexOf('--note');
if (noteIdx >= 0) note = rest[noteIdx + 1];

const matches = findRuns(query);
if (!matches.length) { console.error(`No run matched "${query}".`); process.exit(1); }
if (matches.length > 1) {
  console.error(`Ambiguous "${query}" — ${matches.length} runs match. Be more specific:\n`);
  matches.slice(0, 10).forEach(m => console.error(`  ${m.date}/${m.slug}`));
  process.exit(1);
}

const target = matches[0];
const current = loadStatus(target.runDir);
const prevStage = current.stage || 'unknown';
const updated = { ...current, stage };
if (note !== undefined) updated.notes = note;
saveStatus(target.runDir, updated);
console.log(`✓ ${target.date}/${target.slug}`);
console.log(`  ${prevStage} → ${stage}`);
if (note !== undefined) console.log(`  note: ${note}`);
console.log(`\nRegenerate dashboard:  node auto/dashboard.mjs`);
