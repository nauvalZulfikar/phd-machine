/**
 * LinkedIn guest job-search scraper (no login required).
 *
 *   await searchLinkedIn({ keywords, location, remote: 'remote' | 'hybrid' | 'onsite' | 'any', limit })
 *     → [{ title, company, location, url, posted, jobId }]
 *
 * Endpoint:
 *   https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search
 *   Returns server-rendered HTML fragment with one <li> per job card.
 *
 * Params we use:
 *   keywords     URL-encoded
 *   location     URL-encoded (e.g. "Indonesia", "Jakarta", "Worldwide")
 *   f_WT         work type: 1=onsite, 2=remote, 3=hybrid (omit for any)
 *   f_TPR        time posted: r86400=24h, r604800=7d, r2592000=30d
 *   f_E          experience: 2=entry, 3=associate, 4=mid, 5=senior, 6=director
 *   start        pagination offset (page size = 25)
 *
 * Note: LinkedIn DOES NOT publish full Indonesia-eligible flag in the search card.
 * "remote" filter (f_WT=2) gives roles posted as remote, but doesn't guarantee
 * the role accepts candidates from Indonesia. JD body must be inspected per-role.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121';
const PAGE_SIZE = 25;
const WT = { onsite: '1', remote: '2', hybrid: '3' };

function escAttr(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function parseHtml(html) {
  // Split on <li> opening; each block contains one job card
  const blocks = html.split(/<li[\s\S]*?>/).slice(1);
  const out = [];
  for (const block of blocks) {
    const url = (block.match(/href="(https:\/\/[a-z]+\.linkedin\.com\/jobs\/view\/[^"]+)"/i) || [])[1];
    if (!url) continue;
    const jobIdMatch = block.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/);
    const titleMatch = block.match(/<h3 class="base-search-card__title">\s*([\s\S]*?)<\/h3>/);
    const companyMatch = block.match(/<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const locationMatch = block.match(/<span class="job-search-card__location">([\s\S]*?)<\/span>/);
    const postedMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    out.push({
      jobId: jobIdMatch?.[1],
      title: titleMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      company: companyMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      location: locationMatch?.[1]?.replace(/<[^>]+>/g, '').trim() || '',
      url: url.replace(/&amp;/g, '&').split('?')[0],
      posted: postedMatch?.[1] || '',
    });
  }
  return out;
}

export async function searchLinkedIn({
  keywords,
  location = 'Indonesia',
  remote = 'remote',
  experience = '4,5,6',   // mid + senior + director
  timeFilter = 'r604800', // last 7 days
  limit = 100,
}) {
  const wt = WT[remote] || '';
  const out = [];
  let start = 0;
  while (out.length < limit) {
    const params = new URLSearchParams({
      keywords,
      location,
      start: String(start),
    });
    if (wt) params.set('f_WT', wt);
    if (timeFilter) params.set('f_TPR', timeFilter);
    if (experience) params.set('f_E', experience);
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
    if (!r.ok) {
      console.error(`LinkedIn search HTTP ${r.status} at start=${start}`);
      break;
    }
    const html = await r.text();
    const jobs = parseHtml(html);
    if (jobs.length === 0) break;
    out.push(...jobs);
    if (jobs.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 800)); // be polite
  }
  return out.slice(0, limit);
}

export async function fetchJobDescription(jobUrl) {
  // Guest job detail endpoint returns description HTML
  const id = (jobUrl.match(/jobs\/view\/[^\/]*?(\d+)/) || [])[1];
  if (!id) return null;
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) return null;
  const html = await r.text();
  // Strip tags for plaintext description
  const text = html.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}
