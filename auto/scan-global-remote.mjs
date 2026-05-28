#!/usr/bin/env node
/**
 * Aggressive scan for international jobs accepting Indonesia applicants.
 *
 * Strategy:
 *   1. LinkedIn queries with explicit "remote anywhere/worldwide/global" keywords
 *   2. Pull JD body for each candidate (LinkedIn job detail endpoint)
 *   3. Hard-filter by JD content:
 *      - REJECT: "US only", "EU only", "Right to work in X", "must reside in"
 *      - ACCEPT: explicit "anywhere", "worldwide", "APAC", "GMT+7", "Asia"
 *   4. Score each by Indonesia eligibility confidence
 *
 * Run: node auto/scan-global-remote.mjs
 * Output: tmp/global-remote-indo.json + console table
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { searchLinkedIn, fetchJobDescription } from './sources/linkedin.mjs';

// Queries: keywords + WT=2 (remote) + worldwide locations
const QUERIES = [
  // Explicit global-remote keywords
  { keywords: '"remote anywhere" senior data scientist', location: 'Worldwide', remote: 'remote' },
  { keywords: '"remote worldwide" data scientist', location: 'Worldwide', remote: 'remote' },
  { keywords: 'senior data scientist async', location: 'Worldwide', remote: 'remote' },
  { keywords: 'machine learning engineer "anywhere"', location: 'Worldwide', remote: 'remote' },
  { keywords: 'senior data scientist "global remote"', location: 'Worldwide', remote: 'remote' },
  // APAC-focused
  { keywords: 'senior data scientist APAC remote', location: 'Worldwide', remote: 'remote' },
  { keywords: 'machine learning engineer APAC', location: 'Singapore', remote: 'remote' },
  // Crypto / Web3 — typically most permissive
  { keywords: 'data scientist web3 remote', location: 'Worldwide', remote: 'remote' },
  { keywords: 'machine learning engineer crypto remote', location: 'Worldwide', remote: 'remote' },
  // Specific known-global-remote companies (catches their LinkedIn listings)
  { keywords: 'GitLab data scientist', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Hugging Face engineer', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Toptal data scientist', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Andela machine learning', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Turing software engineer', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Deel engineer remote', location: 'Worldwide', remote: 'remote' },
  { keywords: 'Posthog engineer remote', location: 'Worldwide', remote: 'remote' },
];

// JD content classifiers
const JD_HARD_REJECT = [
  /\bUS only\b/i,
  /\bUSA only\b/i,
  /\bUS-based only\b/i,
  /\bUS Citizens only\b/i,
  /\bmust be (a |an )?US (citizen|resident)\b/i,
  /\bauthorized to work in the (US|United States) (without|with no) sponsorship\b/i,
  /\b(must|will|need to) (reside|be (based|located|living)) (in|within|to) (the )?(US|UK|EU|Canada|EEA|EMEA|United States|United Kingdom|European Union|Australia|Singapore)\b/i,
  /\bEU only\b/i,
  /\bEEA only\b/i,
  /\bUK only\b/i,
  /\bCanada only\b/i,
  /\b(EU|EEA|UK) residents only\b/i,
  /\bremote\s*\((Remote)?\s*(US|USA|United States|North America|NA|UK|EU|EMEA|EEA|Canada|Americas)[^)]*\)/i,
  /\bonly hiring (in|from) (the )?(US|UK|EU|EMEA|EEA|Canada|North America|Australia|Singapore|Japan|India)\b/i,
  /\bvalid work authorization in (the )?(US|UK|EU|Canada|United States|United Kingdom)\b/i,
  /\bright to work in (the )?(US|UK|EU|Canada|United States|United Kingdom|Australia|Singapore)\b/i,
];

const JD_SOFT_REJECT = [
  /\bremote\s*-\s*(US|USA|United States|UK|EU|EMEA|Canada|North America|Americas)\b/i,
  /\b(US|UK|EU|EMEA) time zones? only\b/i,
  /\bPacific time only\b/i,
  /\bEastern Time only\b/i,
];

const JD_GLOBAL_OK = [
  /\b(Remote|Work) (anywhere|globally|worldwide|from anywhere)\b/i,
  /\bremote-first\b/i,
  /\bany (time ?zone|country|location)\b/i,
  /\bdistributed (team|company)\b/i,
  /\bhire (globally|worldwide|from anywhere)\b/i,
  /\b(APAC|Asia[ -]?Pacific|Southeast Asia|Indonesia|Jakarta|GMT[+ ]?[78]|UTC[+ ]?[78])\b/i,
  /\bopen to (all|any) (location|country|timezone)\b/i,
];

function classifyJd(jd) {
  if (!jd) return { verdict: 'unknown', reasons: ['no JD'] };
  const reasons = [];

  for (const re of JD_HARD_REJECT) {
    if (re.test(jd)) reasons.push(`HARD-REJECT: ${re.source.slice(0, 60)}`);
  }
  if (reasons.length) return { verdict: 'reject', reasons };

  let softCount = 0;
  for (const re of JD_SOFT_REJECT) {
    if (re.test(jd)) { softCount++; reasons.push(`soft-reject: ${re.source.slice(0, 60)}`); }
  }
  if (softCount >= 1) return { verdict: 'reject', reasons };

  let globalSignal = 0;
  for (const re of JD_GLOBAL_OK) {
    if (re.test(jd)) { globalSignal++; reasons.push(`+global: ${re.source.slice(0, 60)}`); }
  }

  if (globalSignal >= 2) return { verdict: 'accept', reasons };
  if (globalSignal === 1) return { verdict: 'maybe', reasons };
  return { verdict: 'unclear', reasons: ['no strong global signal, no hard rejects'] };
}

async function main() {
  console.log(`Aggressive global-remote scan, ${QUERIES.length} queries\n`);

  // Cache JD lookups to avoid re-fetching during dev iteration
  const cacheFile = 'tmp/linkedin-jd-cache.json';
  const jdCache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf-8')) : {};

  const seen = new Set();
  const allJobs = [];
  for (const q of QUERIES) {
    process.stdout.write(`  ${q.keywords.slice(0, 50).padEnd(52)} | ${q.location.padEnd(11)} → `);
    try {
      const jobs = await searchLinkedIn({ ...q, limit: 25, timeFilter: 'r2592000', experience: '4,5,6' });
      let n = 0;
      for (const j of jobs) {
        if (!j.jobId || seen.has(j.jobId)) continue;
        seen.add(j.jobId);
        allJobs.push({ ...j, _query: q });
        n++;
      }
      console.log(`${jobs.length} found, ${n} new (total ${allJobs.length})`);
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${allJobs.length} unique candidates. Fetching JDs to verify Indonesia eligibility...\n`);

  let accept = 0, maybe = 0, reject = 0, unclear = 0;
  let i = 0;
  for (const j of allJobs) {
    i++;
    if (jdCache[j.jobId]) {
      j.jdText = jdCache[j.jobId];
    } else {
      try {
        const text = await fetchJobDescription(j.url);
        j.jdText = text || '';
        jdCache[j.jobId] = j.jdText;
      } catch {
        j.jdText = '';
      }
      await new Promise(r => setTimeout(r, 700));
    }
    j.eligibility = classifyJd(j.jdText);
    if (j.eligibility.verdict === 'accept') accept++;
    else if (j.eligibility.verdict === 'maybe') maybe++;
    else if (j.eligibility.verdict === 'reject') reject++;
    else unclear++;
    if (i % 10 === 0) process.stdout.write(`  ${i}/${allJobs.length}\r`);
  }
  process.stdout.write(`  ${allJobs.length}/${allJobs.length}\n\n`);

  writeFileSync(cacheFile, JSON.stringify(jdCache, null, 2));
  writeFileSync('tmp/global-remote-indo.json', JSON.stringify(allJobs, null, 2));

  console.log(`Verdict breakdown:`);
  console.log(`  🟢 accept  (clear global+APAC/anywhere signal): ${accept}`);
  console.log(`  🟡 maybe   (one global signal, no rejects):     ${maybe}`);
  console.log(`  ⚪ unclear (no signal either way):              ${unclear}`);
  console.log(`  🔴 reject  (geo-locked in JD):                   ${reject}`);
  console.log();

  const printTier = (label, color, list) => {
    if (!list.length) return;
    console.log(`\n${color} ━━━ ${label} (${list.length}) ━━━`);
    list.forEach((j, idx) => {
      const t = j.title.length > 50 ? j.title.slice(0, 48) + '..' : j.title.padEnd(50);
      const co = j.company.length > 22 ? j.company.slice(0, 20) + '..' : j.company.padEnd(22);
      const loc = (j.location || '').slice(0, 28);
      console.log(`${String(idx + 1).padStart(2)}. ${t} | ${co} | ${loc}`);
    });
  };
  printTier('🟢 ACCEPT — strong global-remote signal', '🟢', allJobs.filter(j => j.eligibility.verdict === 'accept'));
  printTier('🟡 MAYBE — one signal, worth verifying', '🟡', allJobs.filter(j => j.eligibility.verdict === 'maybe').slice(0, 15));
  console.log(`\n(${unclear} unclear, ${reject} rejected — see tmp/global-remote-indo.json)`);
}

main().catch(e => { console.error(e); process.exit(1); });
