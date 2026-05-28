#!/usr/bin/env node
/**
 * Debug helper: dump HTML + screenshot from each source's search URL.
 * Run: node auto/sources/_debug_dump.mjs
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { getPage, shutdownBrowser } from './_browser.mjs';

const TMP = resolve('tmp/scraper-debug');
mkdirSync(TMP, { recursive: true });

const sites = [
  {
    name: 'jobs_ac_uk',
    url: 'https://www.jobs.ac.uk/search/?keywords=digital%20twin%20logistics',
  },
  {
    name: 'euraxess',
    url: 'https://euraxess.ec.europa.eu/jobs/search?search_api_fulltext=digital%20twin%20logistics',
  },
  {
    name: 'findaphd',
    url: 'https://www.findaphd.com/funded-phd-projects/?Keywords=digital%20twin%20logistics',
  },
];

async function main() {
  for (const s of sites) {
    console.log(`\n--- ${s.name} ---`);
    const { page, close } = await getPage();
    try {
      console.log(`  Go: ${s.url}`);
      await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(5000);
      const title = await page.title();
      const url = page.url();
      console.log(`  Title: ${title}`);
      console.log(`  Final URL: ${url}`);

      const html = await page.content();
      writeFileSync(resolve(TMP, `${s.name}.html`), html, 'utf-8');
      await page.screenshot({ path: resolve(TMP, `${s.name}.png`), fullPage: false });

      // Try multiple candidate selectors
      const found = await page.evaluate(() => {
        const candidates = [
          // jobs.ac.uk
          '.result', '.job-result', '[data-test="result"]', 'article.job', '.j-search-result',
          // EURAXESS
          '.ecl-content-item', '.views-row', 'article.node--type-job', '.node--type-job',
          // FindAPhD
          '.phd-search-result', '.resultsRow', '[data-result-id]', '.resultCard',
          'a[href*="/phds/project/"]', 'a[href*="/job/"]', 'a[href*="/jobs/"]',
        ];
        return Object.fromEntries(candidates.map(s => [s, document.querySelectorAll(s).length]));
      });
      console.log('  Selectors found:');
      for (const [sel, n] of Object.entries(found)) {
        if (n > 0) console.log(`    ${sel.padEnd(40)} → ${n}`);
      }
    } catch (e) {
      console.error(`  ERR: ${e.message}`);
    } finally {
      await close();
    }
  }
  await shutdownBrowser();
}

main();
