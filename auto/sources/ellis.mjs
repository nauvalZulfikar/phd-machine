/**
 * ELLIS Jobs scraper (https://ellis.eu/research/jobs)
 *
 * ELLIS = European Laboratory for Learning and Intelligent Systems.
 * Curated list of PhD / postdoc / research positions at top European ML labs.
 * Typically 15-30 live positions, paginated. No anti-bot (Cloudflare-free).
 *
 *   await searchEllis({ keywords, types, limit })
 *     → [{ source, sourceId, url, title, organization, location, type,
 *          deadline, postedDate, fundingType, description }]
 *
 * Job type inference from title:
 *   "PhD ..."           → phd
 *   "Postdoc / Postdoctoral / Fellowship" → postdoc
 *   "Group Leader / Research Manager / Internship" → research
 */

import { getPage } from './_browser.mjs';

const BASE_URL = 'https://ellis.eu';
const JOBS_URL = `${BASE_URL}/research/jobs`;

function mapType(title) {
  const t = String(title || '').toLowerCase();
  if (/\bphd\b|\bph\.?d\.?|doctoral|fellowship\b/.test(t) && !/postdoc/.test(t)) return 'phd';
  if (/postdoc|post-doc|postdoctoral|research fellow/.test(t)) return 'postdoc';
  if (/internship/.test(t)) return 'research';
  if (/group leader|research manager|administrator/.test(t)) return 'research';
  return 'other';
}

function normaliseDeadline(s) {
  // ELLIS uses DD/MM/YY format. Convert to YYYY-MM-DD.
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return s;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

async function scrapePage(page, pageNum = 1) {
  const url = pageNum > 1 ? `${JOBS_URL}?page=${pageNum}` : JOBS_URL;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Wait for job list — ELLIS uses Drupal-style classes
  try {
    await page.waitForSelector('a[href*="/research/jobs/"]', { timeout: 15_000 });
  } catch {
    return [];
  }

  const rawJobs = await page.evaluate(() => {
    const out = [];
    const seenHrefs = new Set();

    // Find all anchors that link to individual jobs (must contain a date prefix or specific job slug)
    const allLinks = document.querySelectorAll('a[href*="/research/jobs/"]');
    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      // Skip the listing page itself, pagination, filters
      if (href === '/research/jobs' || href === '/research/jobs/' || href.includes('?page=')) return;
      // Job URLs look like /research/jobs/YYYY-MM-DD-slug or /research/jobs/slug
      const slug = href.replace(/^\/research\/jobs\//, '');
      if (!slug || slug.length < 10) return;
      if (seenHrefs.has(href)) return;
      seenHrefs.add(href);

      const title = (link.textContent || '').trim();
      if (!title || title.length < 8) return;

      // Walk up to find the parent card and pull deadline + institution text
      let card = link;
      for (let i = 0; i < 5; i++) {
        if (!card.parentElement) break;
        card = card.parentElement;
        if (card.textContent && card.textContent.length > 80) break;
      }
      const cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();

      // Deadline pattern: "deadline DD/MM/YY" or just "DD/MM/YY"
      const deadlineMatch = cardText.match(/(?:deadline[:\s]*)?(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      const deadline = deadlineMatch ? deadlineMatch[1] : null;

      // Institution: look for common ELLIS site / city names (Aarhus, Vienna, Delft, Potsdam, Copenhagen, Tübingen, etc.)
      // Or text after the title up to deadline.
      const institutionMatch = cardText.match(/(?:at|@)\s+([A-Z][A-Za-z\s\-.,]+(?:University|Institute|Lab|Laboratory|Centre|Center|TU|VIB|MPI))/);
      const institution = institutionMatch ? institutionMatch[1].trim() : '';

      out.push({
        href,
        title,
        cardText: cardText.slice(0, 400),
        deadline,
        institution,
      });
    });
    return out;
  });

  return rawJobs;
}

export async function searchEllis({
  keywords = [],
  types = ['phd', 'postdoc', 'research'],
  limit = 50,
} = {}) {
  const { page, close } = await getPage();
  try {
    const allRaw = [];
    // ELLIS usually has 1-3 pages of jobs at most
    for (let p = 1; p <= 3; p++) {
      const pageJobs = await scrapePage(page, p);
      if (pageJobs.length === 0) break;
      allRaw.push(...pageJobs);
      if (allRaw.length >= limit) break;
    }

    // Dedup across pages by href
    const seen = new Set();
    const deduped = allRaw.filter(j => {
      if (seen.has(j.href)) return false;
      seen.add(j.href);
      return true;
    });

    // Optional keyword filter: keep if title or cardText contains any keyword
    const filtered = keywords.length === 0
      ? deduped
      : deduped.filter(j => {
          const hay = `${j.title} ${j.cardText}`.toLowerCase();
          return keywords.some(k => hay.includes(k.toLowerCase()));
        });

    const opportunities = [];
    for (const raw of filtered.slice(0, limit)) {
      const type = mapType(raw.title);
      if (types.length && !types.includes(type) && type !== 'other') continue;

      const fullUrl = raw.href.startsWith('http') ? raw.href : `${BASE_URL}${raw.href}`;
      const slugId = raw.href.replace(/^\/research\/jobs\//, '').replace(/\/$/, '');
      const sourceId = `ellis-${slugId}`;

      opportunities.push({
        source: 'ellis',
        sourceId,
        url: fullUrl,
        title: raw.title,
        organization: raw.institution || 'ELLIS Network',
        location: raw.institution || '',
        country: '',  // ELLIS doesn't always show country on listing
        type,
        deadline: normaliseDeadline(raw.deadline),
        postedDate: null,
        fundingType: 'funded',  // ELLIS positions are funded by definition
        fundingDetails: '',
        supervisor: null,
        keywords,
        fields: [],
        description: raw.cardText,
      });
    }

    return opportunities;
  } finally {
    await close();
  }
}

// Standalone test: node auto/sources/ellis.mjs
import { fileURLToPath } from 'url';
import { resolve as _resolve } from 'path';
const _isMain = process.argv[1] && fileURLToPath(import.meta.url) === _resolve(process.argv[1]);
if (_isMain) {
  const results = await searchEllis({
    keywords: [],  // empty = all
    types: ['phd', 'postdoc'],
    limit: 30,
  });
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n→ ${results.length} ELLIS opportunities found`);
}
