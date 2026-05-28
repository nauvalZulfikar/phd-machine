/**
 * FindAPhD.com scraper (https://www.findaphd.com)
 *
 * FindAPhD is the largest dedicated PhD listing site (UK + EU + global).
 * The site is behind Cloudflare bot challenges, so plain fetch returns 403.
 * Playwright with a real browser context passes the challenge.
 *
 *   await searchFindAPhD({ keywords, fundingStatus, countries, limit })
 *
 * Search URL pattern:
 *   https://www.findaphd.com/phds/?Keywords=digital+twin
 *   https://www.findaphd.com/funded-phd-projects/
 *
 * fundingStatus values: 'funded' | 'self-funded' | 'all'
 */

import { getPage } from './_browser.mjs';

const SEARCH_URL = 'https://www.findaphd.com/phds/';
const FUNDED_URL = 'https://www.findaphd.com/funded-phd-projects/';

export async function searchFindAPhD({
  keywords = [],
  fundingStatus = 'funded',
  countries = [],
  limit = 100,
} = {}) {
  const { page, close } = await getPage();
  try {
    const params = new URLSearchParams();
    if (keywords && keywords.length) {
      params.set('Keywords', keywords.join(' '));
    }
    const baseUrl = fundingStatus === 'funded' ? FUNDED_URL : SEARCH_URL;
    const url = `${baseUrl}?${params.toString()}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // Wait through Cloudflare challenge — title changes from "Just a moment..." to real title.
    // NOTE: FindAPhD uses CF Turnstile which often blocks headless Playwright fully.
    // For reliable use, run with INTERACTIVE=true once to manually solve, save session
    // (TODO: persistent context with --user-data-dir), then daily runs reuse cookies.
    let cleared = false;
    for (let i = 0; i < 30; i++) {
      const title = await page.title();
      if (!/just a moment|attention required|cloudflare/i.test(title)) { cleared = true; break; }
      await page.waitForTimeout(1000);
    }
    if (!cleared) {
      console.error(`  ! FindAPhD: Cloudflare Turnstile blocking. Run with HEADLESS=false and solve manually, or use persistent context.`);
      return [];
    }
    await page.waitForTimeout(3000);

    const linksFound = await page.evaluate(() => document.querySelectorAll('a[href*="/phds/project/"]').length);
    if (linksFound === 0) {
      console.error(`  ! FindAPhD: no project links found after CF clear (selectors may have changed)`);
      return [];
    }

    const rawJobs = await page.evaluate(() => {
      // Cards have varied class names across FindAPhD redesigns; rely on link pattern
      const links = document.querySelectorAll('a[href*="/phds/project/"]');
      const seen = new Set();
      const out = [];
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || seen.has(href)) return;
        // Skip pagination & filter links
        if (!href.match(/p\d+/i) && !href.match(/project\//i)) return;
        seen.add(href);

        // Walk up to find the card container
        let card = link;
        for (let i = 0; i < 6; i++) {
          if (card.classList && [...card.classList].some(c => /result|card|phd|row/i.test(c))) break;
          card = card.parentElement;
          if (!card) break;
        }
        if (!card) card = link.parentElement;

        const title = (link.textContent || '').trim().replace(/\s+/g, ' ');
        const text = (card.textContent || '').replace(/\s+/g, ' ').trim();

        // Institution: usually a separate <a> linking to /universities/ or shown in italics
        const instEl = card.querySelector('a[href*="/universities/"], .institution, .university');
        const institution = instEl ? instEl.textContent.trim() : '';

        // Supervisor: usually preceded by "Supervisor:" or shown in a "by Dr X"
        const supMatch = text.match(/Supervisor[s]?:?\s*([A-Z][a-zA-Z\.\-\s,]{3,80}?)(?=\s+Department|\s+Application|\s+Deadline|\s+Funding|$)/);
        const supervisor = supMatch ? supMatch[1].trim() : null;

        // Deadline
        const deadlineMatch = text.match(/(?:Application\s*Deadline|Deadline)[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+[0-9]{4}|[0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i);
        const deadline = deadlineMatch ? deadlineMatch[1] : '';

        // Funding tag
        const fundedMatch = text.match(/(Funded PhD Project|Self-Funded PhD Project|Competition Funded|Self Funded)/i);
        const fundingTag = fundedMatch ? fundedMatch[1] : '';

        // Country/city hint
        const locMatch = text.match(/\b(United Kingdom|UK|Europe|EU|USA|United States|Australia|Singapore|Netherlands|Germany|France|Switzerland|Italy|Spain|Sweden|Denmark|Norway|Finland|Belgium|Austria|Ireland)\b/i);
        const country = locMatch ? locMatch[1] : '';

        out.push({ href, title, institution, supervisor, deadline, fundingTag, country, text: text.slice(0, 500) });
      });
      return out;
    });

    const trimmed = rawJobs.slice(0, limit);
    const opportunities = [];
    for (const raw of trimmed) {
      if (countries.length && raw.country && !countries.some(c => raw.country.toLowerCase().includes(c.toLowerCase()))) continue;

      const fullUrl = raw.href.startsWith('http') ? raw.href : `https://www.findaphd.com${raw.href}`;
      const idMatch = raw.href.match(/[?&]p(\d+)/i) || raw.href.match(/project\/([^\/\?]+)/);
      const sourceId = idMatch ? `findaphd-${idMatch[1]}` : `findaphd-${raw.href.split('/').pop()}`;

      const fundingType = /Self-?Funded/i.test(raw.fundingTag) ? 'self-funded'
        : /Funded|Competition/i.test(raw.fundingTag) ? 'funded' : 'unknown';

      opportunities.push({
        source: 'findaphd',
        sourceId,
        url: fullUrl,
        title: raw.title,
        organization: raw.institution,
        location: raw.country || '',
        country: raw.country || '',
        type: 'phd',  // FindAPhD is PhD-only
        deadline: raw.deadline || null,
        postedDate: null,
        fundingType,
        fundingDetails: raw.fundingTag,
        supervisor: raw.supervisor,
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

import { fileURLToPath } from 'url';
import { resolve as _resolve } from 'path';
const _isMain = process.argv[1] && fileURLToPath(import.meta.url) === _resolve(process.argv[1]);
if (_isMain) {
  const results = await searchFindAPhD({
    keywords: ['digital twin', 'logistics'],
    fundingStatus: 'funded',
    limit: 10,
  });
  console.log(JSON.stringify(results, null, 2));
  console.log(`\n→ ${results.length} opportunities found`);
}
