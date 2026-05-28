#!/usr/bin/env node
/**
 * Academic discovery orchestrator.
 *
 *   node auto/discover.mjs [--keywords "digital twin,logistics"] [--types phd,postdoc,research]
 *                         [--countries UK,US,Germany] [--limit 100]
 *                         [--sources euraxess,jobs_ac_uk,findaphd]
 *
 * What it does:
 *   1. Runs each enabled source scraper in sequence (shared browser)
 *   2. Merges results, dedups against data/academic/opportunities.jsonl
 *   3. Appends novel opportunities to opportunities.jsonl
 *   4. Writes a daily digest data/academic/digests/YYYY-MM-DD.md
 *   5. Prints summary table to stdout
 *
 * Run daily via cron / Windows Task Scheduler:
 *   0 7 * * *  cd /path/to/career-ops && node auto/discover.mjs >> logs/discover.log
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';

import { searchEuraxess } from './sources/euraxess.mjs';
import { searchJobsAcUk } from './sources/jobs_ac_uk.mjs';
import { searchFindAPhD } from './sources/findaphd.mjs';
import { searchEllis } from './sources/ellis.mjs';
import { shutdownBrowser } from './sources/_browser.mjs';

const DATA_DIR = resolve('data/academic');
const OPPS_FILE = resolve(DATA_DIR, 'opportunities.jsonl');
const DIGEST_DIR = resolve(DATA_DIR, 'digests');

function parseArgs(argv) {
  const args = {
    keywords: ['machine learning', 'data science', 'natural language processing', 'large language model', 'LLM', 'NLP', 'RAG', 'responsible AI', 'trustworthy AI', 'credit risk', 'model risk', 'fraud detection', 'time series', 'causal inference', 'recommender', 'foundation model', 'representation learning', 'deep learning', 'applied AI', 'AI safety', 'interpretability', 'XAI', 'graph neural network', 'tabular learning'],
    types: ['phd', 'postdoc', 'research'],
    countries: [],
    limit: 100,
    sources: ['euraxess', 'jobs_ac_uk', 'findaphd', 'ellis'],
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--keywords') { args.keywords = next.split(',').map(s => s.trim()); i++; }
    else if (arg === '--types') { args.types = next.split(',').map(s => s.trim()); i++; }
    else if (arg === '--countries') { args.countries = next.split(',').map(s => s.trim()); i++; }
    else if (arg === '--limit') { args.limit = parseInt(next, 10); i++; }
    else if (arg === '--sources') { args.sources = next.split(',').map(s => s.trim()); i++; }
  }
  return args;
}

function loadExistingIds() {
  const seen = new Set();
  if (!existsSync(OPPS_FILE)) return seen;
  const lines = readFileSync(OPPS_FILE, 'utf-8').split('\n').filter(Boolean);
  for (const line of lines) {
    try { seen.add(JSON.parse(line).sourceId); } catch {}
  }
  return seen;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Strip newlines and optionally trim to max length
function stripNewlines(s, maxLen = 0) {
  const clean = (s || '').replace(/[\r\n]/g, ' ');
  return maxLen ? clean.slice(0, maxLen) : clean;
}

function writeDigest(novel, today) {
  mkdirSync(DIGEST_DIR, { recursive: true });
  const path = resolve(DIGEST_DIR, `${today}.md`);
  const bySource = novel.reduce((acc, o) => {
    (acc[o.source] = acc[o.source] || []).push(o);
    return acc;
  }, {});

  const lines = [
    `# Academic Discovery Digest — ${today}`,
    ``,
    `**Total new opportunities:** ${novel.length}`,
    ``,
  ];
  for (const [src, items] of Object.entries(bySource)) {
    lines.push(`## ${src} (${items.length})`);
    lines.push('');
    for (const o of items) {
      const meta = [
        o.type ? `**${o.type}**` : '',
        o.organization || '',
        o.country || o.location || '',
        o.deadline ? `Deadline: ${o.deadline}` : '',
        o.fundingType !== 'unknown' ? o.fundingType : '',
      ].filter(Boolean).join(' · ');
      lines.push(`### [${o.title}](${o.url})`);
      lines.push(`${meta}`);
      if (o.supervisor) lines.push(`Supervisor: ${o.supervisor}`);
      lines.push('');
    }
  }
  writeFileSync(path, lines.join('\n'), 'utf-8');
  return path;
}

async function runSource(name, args) {
  const t0 = Date.now();
  try {
    let results;
    if (name === 'euraxess') {
      results = await searchEuraxess({
        keywords: args.keywords,
        types: args.types,
        countries: args.countries,
        limit: args.limit,
      });
    } else if (name === 'jobs_ac_uk') {
      results = await searchJobsAcUk({
        keywords: args.keywords,
        types: args.types,
        locations: args.countries,
        limit: args.limit,
      });
    } else if (name === 'findaphd') {
      results = await searchFindAPhD({
        keywords: args.keywords,
        fundingStatus: 'funded',
        countries: args.countries,
        limit: args.limit,
      });
    } else if (name === 'ellis') {
      results = await searchEllis({
        keywords: [],  // ELLIS list is small and already curated — fetch all and filter at scoring
        types: args.types,
        limit: args.limit,
      });
    } else {
      console.log(`  ! unknown source: ${name}`);
      return [];
    }
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${name}: ${results.length} results (${elapsed}s)`);
    return results;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    return [];
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const today = todayIso();

  console.log(`━━━ Academic Discovery ━━━`);
  console.log(`Date:      ${today}`);
  console.log(`Keywords:  ${args.keywords.join(', ')}`);
  console.log(`Types:     ${args.types.join(', ')}`);
  console.log(`Sources:   ${args.sources.join(', ')}`);
  console.log(``);

  mkdirSync(DATA_DIR, { recursive: true });
  const seen = loadExistingIds();
  console.log(`Existing opportunities tracked: ${seen.size}`);
  console.log(``);

  const allResults = [];
  for (const src of args.sources) {
    const r = await runSource(src, args);
    allResults.push(...r);
    // Reset browser between sources to prevent state leakage
    await shutdownBrowser();
  }

  console.log(``);
  console.log(`Total scraped: ${allResults.length}`);

  // Dedup
  const novel = [];
  for (const opp of allResults) {
    if (!opp.sourceId) continue;
    if (seen.has(opp.sourceId)) continue;
    seen.add(opp.sourceId);
    novel.push({ ...opp, discoveredAt: new Date().toISOString() });
  }
  console.log(`Novel (after dedup): ${novel.length}`);

  // Persist
  if (novel.length) {
    const lines = novel.map(o => JSON.stringify(o)).join('\n') + '\n';
    appendFileSync(OPPS_FILE, lines, 'utf-8');
    const digestPath = writeDigest(novel, today);
    console.log(`Wrote digest: ${digestPath}`);
  }

  // Console summary table
  if (novel.length) {
    console.log(``);
    console.log(`━━━ Top ${Math.min(10, novel.length)} novel opportunities ━━━`);
    novel.slice(0, 10).forEach((o, i) => {
      const safeTitle = stripNewlines(o.title, 70);
      const safeOrg = stripNewlines(o.organization);
      const safeCountry = stripNewlines(o.country || o.location || '?');
      console.log(`${(i + 1).toString().padStart(2)}. [${o.source}] ${(o.type || '?').padEnd(8)} ${safeTitle}`);
      console.log(`    ${safeOrg} · ${safeCountry}${o.deadline ? ` · Deadline: ${o.deadline}` : ''}`);
    });
  }

  await shutdownBrowser();

  const bySource = novel.reduce((acc, o) => {
    acc[o.source] = (acc[o.source] || 0) + 1;
    return acc;
  }, {});
  console.log('__SUMMARY__ ' + JSON.stringify({ novel: novel.length, total: allResults.length, bySource }));
}

main().catch(err => {
  console.error('FATAL:', err);
  shutdownBrowser().catch(() => {});
  process.exit(1);
});
