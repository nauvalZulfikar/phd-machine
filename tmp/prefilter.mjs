/**
 * Programmatic pre-filter: parse pipeline.md, drop obvious blockers,
 * fetch full JDs via Ashby/Greenhouse/Lever APIs for survivors.
 * Output: tmp/candidates.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const PIPELINE = readFileSync('data/pipeline.md', 'utf8');
const lines = PIPELINE.split('\n').filter(l => l.startsWith('- [ ]'));

// Parse entries
const entries = lines.map(l => {
  // Format: - [ ] URL | COMPANY | TITLE
  const m = l.match(/^- \[ \] (\S+)\s*\|\s*([^|]+?)\s*\|\s*(.+)$/);
  if (!m) return null;
  return { url: m[1].trim(), company: m[2].trim(), title: m[3].trim() };
}).filter(Boolean);

console.log(`Total in pipeline: ${entries.length}`);

// HARD-FILTER: title
const TITLE_BLOCK = /\b(Junior|Intern|Apprentice|New Grad|Graduate Program|Bootcamp|Summer Job|Director|VP\b|Head of|CTO|Chief\b|Engineering Manager|Manager,\s*(Solutions|Customer Success|Sales|Marketing|Business)|Account Executive|Sales (Engineer|Trainer|Manager)|Solutions Consultant|Solutions Engineer|Solutions Architect|Customer Engineer|Forward Deployed|Pre-Sales|Partner Manager|Customer Success|Mid-Market|Strategic Customer|Field|Government Affairs|Music|Editor|Designer|Designer|Hacking for Health|Speaking)/i;

// HARD-FILTER: keep titles
const TITLE_KEEP = /\b(Data Scientist|Data Engineer|Analytics Engineer|Machine Learning|ML Engineer|Applied Scientist|Research (Engineer|Scientist)|Decision Scientist|Quantitative|Risk Modeler|AI Engineer|LLM Engineer|MLOps|Senior\s+(AI|ML)|Staff\s+(AI|ML)|Principal\s+(AI|ML))/i;

const passTitle = entries.filter(e => !TITLE_BLOCK.test(e.title) && TITLE_KEEP.test(e.title));
console.log(`After title filter: ${passTitle.length}`);

// API URL builders
function getApiUrl(jobUrl) {
  // Ashby
  let m = jobUrl.match(/jobs\.ashbyhq\.com\/([^/]+)\/([\w-]+)/);
  if (m) return { type: 'ashby', board: m[1], id: m[2], url: `https://api.ashbyhq.com/posting-api/job-board/${m[1]}?includeCompensation=true` };
  // Greenhouse
  m = jobUrl.match(/(?:job-boards|boards)(?:\.eu)?\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
  if (m) return { type: 'greenhouse', board: m[1], id: m[2], url: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}` };
  // Lever
  m = jobUrl.match(/jobs\.lever\.co\/([^/]+)\/([\w-]+)/);
  if (m) return { type: 'lever', board: m[1], id: m[2], url: `https://api.lever.co/v0/postings/${m[1]}/${m[2]}` };
  return null;
}

// Cache board fetches (Ashby returns all jobs per board)
const boardCache = new Map();

async function fetchJD(entry) {
  const api = getApiUrl(entry.url);
  if (!api) return null;
  try {
    if (api.type === 'ashby') {
      let board = boardCache.get(`ashby:${api.board}`);
      if (!board) {
        const res = await fetch(api.url, { signal: AbortSignal.timeout(15000) });
        board = await res.json();
        boardCache.set(`ashby:${api.board}`, board);
      }
      const job = (board.jobs || []).find(j => j.id === api.id);
      if (!job) return null;
      return {
        title: job.title,
        location: job.location || '',
        secondaryLocations: job.secondaryLocations || [],
        isRemote: job.isRemote,
        workplaceType: job.workplaceType,
        department: job.department || '',
        descriptionPlain: job.descriptionPlain || '',
        applyUrl: job.applyUrl,
      };
    } else if (api.type === 'greenhouse') {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(15000) });
      const job = await res.json();
      return {
        title: job.title,
        location: job.location?.name || '',
        descriptionPlain: (job.content || '').replace(/<[^>]+>/g, ''),
        applyUrl: job.absolute_url,
      };
    } else if (api.type === 'lever') {
      const res = await fetch(api.url, { signal: AbortSignal.timeout(15000) });
      const job = await res.json();
      return {
        title: job.text,
        location: job.categories?.location || '',
        descriptionPlain: (job.descriptionPlain || job.description || '').replace(/<[^>]+>/g, ''),
        applyUrl: `${entry.url}/apply`,
      };
    }
  } catch (e) {
    return { error: e.message };
  }
  return null;
}

// Concurrency-limited fetch
async function batched(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    results.push(...await Promise.all(chunk.map(fn)));
    process.stdout.write(`  ${Math.min(i+limit, items.length)}/${items.length}\r`);
  }
  process.stdout.write('\n');
  return results;
}

console.log('Fetching JDs...');
const enriched = await batched(passTitle, 8, async (e) => ({ ...e, jd: await fetchJD(e) }));

// Drop fetch failures
const fetched = enriched.filter(e => e.jd && !e.jd.error);
console.log(`Successfully fetched: ${fetched.length}`);

// HARD-FILTER: JD content
const JD_BLOCK = /(security clearance|SC clearance|TS\/SCI|US citizen|US Citizen|United States citizen|must be authorized to work in the U\.?S\.?|must be eligible for U\.?S\.?\s*government|UK Security Clearance|DV cleared|British citizen|Indian citizen|right to work in (the )?(US|United States))/i;

const noLegalBlock = fetched.filter(e => !JD_BLOCK.test(e.jd.descriptionPlain));
console.log(`After legal/clearance filter: ${noLegalBlock.length}`);

// LOCATION FILTER: must be remote-eligible OR EU/UK
const LOC_OK = /(remote|anywhere|worldwide|distributed|global|europe|emea|united kingdom|england|london|cambridge|manchester|edinburgh|dublin|ireland|germany|berlin|munich|hamburg|netherlands|amsterdam|rotterdam|france|paris|spain|barcelona|madrid|italy|milan|rome|portugal|lisbon|sweden|stockholm|denmark|copenhagen|norway|oslo|finland|helsinki|poland|warsaw|switzerland|zurich|austria|vienna|belgium|brussels|czech|prague)/i;

const LOC_HARD_BLOCK = /(only|exclusively).{0,30}(US|United States|USA|North America|NA|India|Bengaluru|Bangalore|Hong Kong|Singapore|Tokyo|Japan|Korea|Seoul|Australia|Sydney|Brazil|São Paulo|Mexico|Chile|Israel|Tel Aviv|UAE|Dubai)/i;

const locOk = noLegalBlock.filter(e => {
  const allLoc = [e.jd.location, ...(e.jd.secondaryLocations || []).map(s => s.location || '')].join(' ');
  const inText = (e.jd.descriptionPlain.slice(0, 1500) + ' ' + allLoc);
  if (LOC_HARD_BLOCK.test(inText)) return false;
  return LOC_OK.test(allLoc) || e.jd.isRemote || LOC_OK.test(inText);
});
console.log(`After location filter: ${locOk.length}`);

mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/candidates.json', JSON.stringify(locOk, null, 2));
console.log(`\n✅ Saved ${locOk.length} candidates to tmp/candidates.json`);

// Summary
console.log('\nCandidate summary by company:');
const byCo = {};
for (const e of locOk) byCo[e.company] = (byCo[e.company] || 0) + 1;
Object.entries(byCo).sort((a, b) => b[1] - a[1]).forEach(([co, n]) => console.log(`  ${n}\t${co}`));
