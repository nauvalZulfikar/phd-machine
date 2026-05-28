#!/usr/bin/env node
/**
 * Scan LinkedIn for data/ML jobs Indonesia-friendly.
 *
 * Usage:
 *   node auto/scan-linkedin.mjs                  # all default queries
 *   node auto/scan-linkedin.mjs --keywords "..."
 *   node auto/scan-linkedin.mjs --json           # JSON output instead of pipeline.md format
 *
 * Output:
 *   tmp/linkedin-jobs.json   (full results with metadata)
 *   data/pipeline-linkedin.md  (markdown list, compatible with prefilter pattern)
 *
 * NOTE: LinkedIn jobs do NOT submit via career-ops pipeline (no ATS adapter).
 * Apply manually via LinkedIn — or use jobflow Chrome extension if it's Easy Apply.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { searchLinkedIn } from './sources/linkedin.mjs';

const DEFAULT_QUERIES = [
  // Indonesia-based
  { keywords: 'Senior Data Scientist', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Senior Data Scientist', location: 'Indonesia', remote: 'hybrid' },
  { keywords: 'Machine Learning Engineer', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Machine Learning Engineer', location: 'Indonesia', remote: 'hybrid' },
  { keywords: 'Lead Data Scientist', location: 'Indonesia', remote: 'any' },
  { keywords: 'Data Engineer', location: 'Indonesia', remote: 'remote' },
  { keywords: 'AI Engineer', location: 'Indonesia', remote: 'any' },
  // APAC remote-friendly
  { keywords: 'Senior Data Scientist', location: 'Singapore', remote: 'remote' },
  { keywords: 'Senior Machine Learning Engineer', location: 'Singapore', remote: 'remote' },
  // Global remote (broader catch — filter again for Indonesia eligibility manually)
  { keywords: 'Senior Data Scientist remote', location: 'Worldwide', remote: 'remote' },
  { keywords: 'Machine Learning Engineer remote', location: 'Worldwide', remote: 'remote' },
];

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');

let queries = DEFAULT_QUERIES;
const kwIdx = args.indexOf('--keywords');
if (kwIdx >= 0) {
  queries = [{ keywords: args[kwIdx + 1], location: 'Indonesia', remote: 'any' }];
}

console.log(`Scanning ${queries.length} LinkedIn queries...\n`);

const all = [];
const seen = new Set();
for (const q of queries) {
  process.stdout.write(`  ${q.keywords.padEnd(40)} | ${q.location.padEnd(12)} | ${q.remote.padEnd(7)} → `);
  try {
    const jobs = await searchLinkedIn({ ...q, limit: 40, timeFilter: 'r2592000', experience: '4,5,6' });
    let added = 0;
    for (const j of jobs) {
      if (!j.jobId || seen.has(j.jobId)) continue;
      seen.add(j.jobId);
      all.push({ ...j, _query: q });
      added++;
    }
    console.log(`${jobs.length} found, ${added} new`);
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1200));
}

mkdirSync(resolve('tmp'), { recursive: true });
writeFileSync(resolve('tmp/linkedin-jobs.json'), JSON.stringify(all, null, 2));
console.log(`\n✓ ${all.length} unique jobs → tmp/linkedin-jobs.json`);

if (!jsonOnly) {
  // Write to data/pipeline-linkedin.md in same format as career-ops scan
  const lines = [
    '## LinkedIn Jobs (scanned ' + new Date().toISOString().slice(0, 10) + ')',
    '',
    '> NOTE: LinkedIn does not submit via career-ops pipeline. Apply manually.',
    '',
  ];
  for (const j of all) {
    lines.push(`- [ ] ${j.url} | ${j.company} | ${j.title}  · ${j.location}`);
  }
  writeFileSync(resolve('data/pipeline-linkedin.md'), lines.join('\n'));
  console.log(`✓ data/pipeline-linkedin.md written`);
}

// Indonesia-friendly summary
const INDO_FRIENDLY = /(Indonesia|Jakarta|Bandung|Surabaya|Bali|Indonesia|Bekasi|Tangerang|Yogyakarta)/i;
const GLOBAL_OK = /(Worldwide|Anywhere|Global|Remote)/i;
const indoCount = all.filter(j => INDO_FRIENDLY.test(j.location)).length;
const globalCount = all.filter(j => GLOBAL_OK.test(j.location) && !INDO_FRIENDLY.test(j.location)).length;
console.log(`\nBreakdown:`);
console.log(`  Indonesia-based:    ${indoCount}`);
console.log(`  Global/Anywhere:    ${globalCount}`);
console.log(`  Other locations:    ${all.length - indoCount - globalCount}`);
