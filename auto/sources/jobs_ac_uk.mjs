/**
 * jobs.ac.uk scraper (https://www.jobs.ac.uk)
 *
 * jobs.ac.uk is the primary UK academic jobs board — PhD studentships,
 * postdocs, lectureships, professorships. Plus increasing global coverage.
 *
 * Their search supports URL parameters and works fine with simple fetch.
 *
 *   await searchJobsAcUk({ keywords, types, locations, limit })
 *
 * URL pattern:
 *   https://www.jobs.ac.uk/search/?keywords=X&academicDiscipline=&jobType[]=A&jobType[]=P
 *   jobType values: A=Academic, P=PhD studentship, R=Research, etc.
 *
 * We use Playwright because jobs.ac.uk's pages occasionally have soft
 * anti-bot checks. Playwright is reliable across runs.
 */

import { getPage } from './_browser.mjs';

const SEARCH_URL = 'https://www.jobs.ac.uk/search/';

function mapType(jobTypeText) {
  const t = String(jobTypeText || '').toLowerCase();
  if (t.includes('phd') || t.includes('studentship') || t.includes('doctoral')) return 'phd';
  if (t.includes('postdoc') || t.includes('post-doc') || t.includes('research fellow')) return 'postdoc';
  if (t.includes('lecturer') || t.includes('professor') || t.includes('reader') || t.includes('faculty')) return 'faculty';
  if (t.includes('research')) return 'research';
  return 'other';
}

function buildSearchUrl(keywords) {
  const params = new URLSearchParams();
  if (keywords && keywords.length) {
    params.set('keywords', keywords.join(' '));
  }
  return `${SEARCH_URL}?${params.toString()}`;
}

async function singleSearch(query, types, locations, limit) {
  const { page, close } = await getPage();
  try {
    const url = `${SEARCH_URL}?${new URLSearchParams({ keywords: query }).toString()}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    await page.waitForTimeout(2000);

    // Dismiss cookie consent if present
    try {
      const consent = await page.$('button:has-text("Accept"), #onetrust-accept-btn-handler, .cc-allow');
      if (consent) { await consent.click().catch(() => {}); await page.waitForTimeout(1000); }
    } catch {}

    try {
      await page.waitForSelector('.j-search-result__result, [data-advert-id]', { timeout: 20_000 });
    } catch {
      const count = await page.evaluate(() => document.querySelectorAll('[data-advert-id]').length);
      console.error(`  ! jobs.ac.uk: selectors not found (data-advert-id count=${count})`);
      return [];
    }

    const rawJobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('.j-search-result__result, [data-advert-id]');
      const out = [];
      cards.forEach(card => {
        const linkEl = card.querySelector('a[href*="/job/"]');
        if (!linkEl) return;
        const href = linkEl.getAttribute('href');
        const title = (linkEl.textContent || '').trim();

        const employerEl = card.querySelector('.j-search-result__employer, .employer');
        const employer = employerEl ? employerEl.textContent.trim() : '';

        const locationEl = card.querySelector('.j-search-result__location, .location');
        const location = locationEl ? locationEl.textContent.trim() : '';

        const salaryEl = card.querySelector('.j-search-result__salary, .salary');
        const salary = salaryEl ? salaryEl.textContent.trim() : '';

        const dateEl = card.querySelector('.j-search-result__date-span, .j-search-result__date');
        const dateText = dateEl ? dateEl.textContent.trim() : '';

        const text = (card.textContent || '').replace(/\s+/g, ' ').trim();

        // Closing date
        const closingMatch = text.match(/Closing\s*(?:date|time)?:?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
        const deadline = closingMatch ? closingMatch[1] : '';

        // Type hint (from text)
        const typeMatch = text.match(/(PhD|Studentship|Postdoctoral|Research Fellow|Lecturer|Professor|Research Associate|Reader)/i);
        const type = typeMatch ? typeMatch[1] : '';

        out.push({ href, title, employer, location, salary, type, deadline, text: text.slice(0, 500) });
      });
      return out;
    });

    const trimmed = rawJobs.slice(0, limit);
    const opportunities = [];
    for (const raw of trimmed) {
      const t = mapType(raw.type + ' ' + raw.title);
      if (types.length && !types.includes(t) && t !== 'other') continue;
      if (locations.length && raw.location && !locations.some(l => raw.location.toLowerCase().includes(l.toLowerCase()))) continue;

      const fullUrl = raw.href.startsWith('http') ? raw.href : `https://www.jobs.ac.uk${raw.href}`;
      const idMatch = raw.href.match(/\/job\/([^\/\?]+)/);
      const sourceId = idMatch ? `jobsacuk-${idMatch[1]}` : `jobsacuk-${raw.href.split('/').pop()}`;

      // Funding inference from salary text
      let fundingType = 'unknown';
      if (raw.salary) {
        if (/£|€|\$|stipend|funded|salary/i.test(raw.salary)) fundingType = 'funded';
        else if (/self[-\s]?fund/i.test(raw.salary)) fundingType = 'self-funded';
      }

      opportunities.push({
        source: 'jobs_ac_uk',
        sourceId,
        url: fullUrl,
        title: raw.title,
        organization: raw.employer,
        location: raw.location,
        country: raw.location.toLowerCase().includes('united kingdom') || /\b(london|manchester|birmingham|edinburgh|oxford|cambridge|bristol|leeds|cardiff|glasgow|sheffield|newcastle|nottingham|coventry|warwick)\b/i.test(raw.location) ? 'United Kingdom' : '',
        type: t,
        deadline: raw.deadline || null,
        postedDate: null,
        fundingType,
        fundingDetails: raw.salary || '',
        supervisor: null,
        keywords: [query],
        fields: [],
        description: raw.text,
      });
    }
    return opportunities;
  } finally {
    await close();
  }
}

export async function searchJobsAcUk({
  keywords = [],
  types = ['phd', 'postdoc', 'research', 'faculty'],
  locations = [],
  limit = 100,
} = {}) {
  // jobs.ac.uk uses AND across keywords. Long keyword lists give 0 results.
  // Run one search per keyword (or pair of related terms) then merge + dedup.
  const queries = keywords.length ? keywords : [''];
  const merged = new Map();
  for (const q of queries) {
    const results = await singleSearch(q, types, locations, limit);
    for (const r of results) {
      if (!merged.has(r.sourceId)) merged.set(r.sourceId, r);
    }
  }
  return Array.from(merged.values()).slice(0, limit);
}

import { fileURLToPath } from 'url';
import { resolve as _resolve } from 'path';
const _isMain = process.argv[1] && fileURLToPath(import.meta.url) === _resolve(process.argv[1]);
if (_isMain) {
  const results = await searchJobsAcUk({
    keywords: ['digital twin', 'logistics'],
    types: ['phd', 'postdoc'],
    limit: 10,
  });
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n→ ${results.length} opportunities found`);
}
