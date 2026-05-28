#!/usr/bin/env node
/**
 * CLI: node auto/apply.mjs <job-url> [--dry-run] [--headed] [--submit]
 *
 * Default behavior: opens browser headless, tailors materials, fills form,
 *   takes screenshot, prints summary, and STOPS before submit.
 *
 * Flags:
 *   --submit    → after fill, actually click submit. (Removes --dry-run.)
 *   --headed    → run browser visible (recommended for --submit so user can monitor).
 *   --batch <file.json>  → apply to each URL in a JSON array of { url } entries.
 */
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { runPipeline } from './pipeline.mjs';
const parseYaml = yaml.load;

const args = process.argv.slice(2);
// `--submit` USED to auto-imply headed (so user could watch in dev). On a
// headless VPS that fails ("no XServer / $DISPLAY"). Make headed strictly opt-in
// via explicit --headed; default everywhere is headless.
const opts = {
  dryRun: !args.includes('--submit'),
  headed: args.includes('--headed'),
  batch: null,
};
const batchIdx = args.indexOf('--batch');
if (batchIdx >= 0) opts.batch = args[batchIdx + 1];

const profile = parseYaml(readFileSync('config/profile.yml', 'utf-8'));

async function main() {
  if (opts.batch) {
    const list = JSON.parse(readFileSync(opts.batch, 'utf-8'));
    const urls = Array.isArray(list) ? list.map(x => x.url || x.jobUrl || x) : [];
    console.log(`Batch mode: ${urls.length} URLs`);
    for (const url of urls) {
      try { await runPipeline(url, { profile, ...opts }); }
      catch (e) { console.error(`✗ ${url}: ${e.message}`); }
      await new Promise(r => setTimeout(r, 5000));
    }
    return;
  }

  const url = args.find(a => /^https?:\/\//.test(a));
  if (!url) {
    console.error('Usage: node auto/apply.mjs <job-url> [--submit] [--headed]');
    console.error('       node auto/apply.mjs --batch <list.json>');
    process.exit(1);
  }
  await runPipeline(url, { profile, ...opts });
}

main().catch(e => { console.error('Pipeline error:', e); process.exit(1); });
