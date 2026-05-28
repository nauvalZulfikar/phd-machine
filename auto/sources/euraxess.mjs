/**
 * EURAXESS Jobs scraper (https://euraxess.ec.europa.eu)
 *
 * EURAXESS is the EU-wide research jobs portal — ~30K live positions across
 * PhD, postdoc, and senior research roles. Their search returns JSON via
 * an internal API (POST). We use Playwright to mimic the search page and
 * intercept the JSON response.
 *
 *   await searchEuraxess({ keywords, types, countries, limit })
 *     → [{ source, sourceId, url, title, organization, location, country,
 *          type, deadline, postedDate, fundingType, fundingDetails,
 *          supervisor, keywords, fields, description }]
 *
 * Job types we map:
 *   "First Stage Researcher (R1)"   → phd
 *   "Recognised Researcher (R2)"    → postdoc
 *   "Established Researcher (R3)"   → research
 *   "Leading Researcher (R4)"       → research
 */

import { getPage } from './_browser.mjs';

const SEARCH_URL = 'https://euraxess.ec.europa.eu/jobs/search';

function mapType(careerStage) {
  const s = String(careerStage || '').toLowerCase();
  if (s.includes('r1') || s.includes('first stage')) return 'phd';
  if (s.includes('r2') || s.includes('recognised')) return 'postdoc';
  if (s.includes('r3') || s.includes('established')) return 'research';
  if (s.includes('r4') || s.includes('leading')) return 'research';
  return 'other';
}

export async function searchEuraxess({
  keywords = [],
  types = ['phd', 'postdoc', 'research'],
  countries = [],
  limit = 100,
} = {}) {
  const { page, close } = await getPage();
  try {
    const query = keywords.join(' ');
    // EURAXESS search uses standard query params
    const url = `${SEARCH_URL}?search_api_fulltext=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // Wait for result cards or "no results"
    try {
      await page.waitForSelector('.ecl-content-item, .views-row, article.node--type-job', { timeout: 15_000 });
    } catch {
      // No results
      return [];
    }

    // Scrape all job cards from page (dedup by href since selectors overlap)
    const rawJobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.ecl-content-item, .views-row article, article.node--type-job');
      const out = [];
      const seenHrefs = new Set();
      cards.forEach(card => {
        const linkEl = card.querySelector('a[href*="/jobs/"]');
        if (!linkEl) return;
        const href = linkEl.getAttribute('href');
        if (!href || seenHrefs.has(href)) return;
        // Skip non-job links (pagination, filter)
        if (!/\/jobs\/\d+/.test(href) && !/\/jobs\/[a-z-]+\/\d+/i.test(href)) return;
        seenHrefs.add(href);
        const title = (linkEl.textContent || '').trim();

        // Try to pull metadata fields shown on result card
        const text = (card.textContent || '').replace(/\s+/g, ' ').trim();

        // Organization usually appears in dedicated span/dd
        const orgEl = card.querySelector('.ecl-content-item__description, .field--name-field-organisation, .organisation');
        const org = orgEl ? (orgEl.textContent || '').trim() : '';

        // Country sometimes in dedicated metadata
        const countryEl = card.querySelector('.field--name-field-country, .ecl-tag, .country');
        const country = countryEl ? (countryEl.textContent || '').trim() : '';

        // Career stage / type
        const stageMatch = text.match(/(First Stage Researcher.*?R1|Recognised Researcher.*?R2|Established Researcher.*?R3|Leading Researcher.*?R4)/i);
        const stage = stageMatch ? stageMatch[1] : '';

        // Deadline
        const deadlineMatch = text.match(/Deadline[:\s]+([0-9]{1,2}[\/\-\s][A-Za-z0-9]+[\/\-\s][0-9]{2,4})/i);
        const deadline = deadlineMatch ? deadlineMatch[1] : '';

        out.push({ href, title, org, country, stage, deadline, text: text.slice(0, 500) });
      });
      return out;
    });

    const limitTrimmed = rawJobs.slice(0, limit);
    const opportunities = [];
    for (const raw of limitTrimmed) {
      const type = mapType(raw.stage);
      if (types.length && !types.includes(type) && type !== 'other') continue;
      if (countries.length && raw.country && !countries.some(c => raw.country.toLowerCase().includes(c.toLowerCase()))) continue;

      const fullUrl = raw.href.startsWith('http')
        ? raw.href
        : `https://euraxess.ec.europa.eu${raw.href}`;
      const idMatch = raw.href.match(/\/jobs\/(?:[\w-]+\/)?(\d+)/);
      const sourceId = idMatch ? `euraxess-${idMatch[1]}` : `euraxess-${raw.href.split('/').pop()}`;

      opportunities.push({
        source: 'euraxess',
        sourceId,
        url: fullUrl,
        title: raw.title,
        organization: raw.org,
        location: raw.country || '',
        country: raw.country || '',
        type,
        deadline: raw.deadline || null,
        postedDate: null,
        fundingType: 'funded',  // EURAXESS positions are almost always funded
        fundingDetails: '',
        supervisor: null,
        keywords,
        fields: [],
        description: raw.text,
      });
    }

    return opportunities;
  } finally {
    await close();
  }
}

// Standalone test: node auto/sources/euraxess.mjs
import { fileURLToPath } from 'url';
import { resolve as _resolve } from 'path';
const _isMain = process.argv[1] && fileURLToPath(import.meta.url) === _resolve(process.argv[1]);
if (_isMain) {
  const results = await searchEuraxess({
    keywords: ['digital twin', 'logistics'],
    types: ['phd', 'postdoc'],
    limit: 10,
  });
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n→ ${results.length} opportunities found`);
}
