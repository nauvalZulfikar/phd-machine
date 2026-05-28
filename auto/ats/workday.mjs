/**
 * Workday adapter (source-only at this time).
 *
 * Reality check (probed 2026-05-15):
 *   - Grab: 0 jobs (ATS migration blackout 24 Nov - 11 Dec)
 *   - Tokopedia, Gojek, Shopee, Lazada, etc.: tenant slugs returned 404
 *     (they likely use bespoke career portals or Workday tenants on different subdomains)
 *
 * Pattern when a Workday board IS active:
 *   Browse:  https://<tenant>.<wd1|wd3|wd5>.myworkdayjobs.com/<site>
 *   Public API:
 *     POST https://<tenant>.<wd?>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs
 *     Body: {"appliedFacets":{},"limit":20,"offset":0,"searchText":"..."}
 *   Required: cookie session (visit landing page first to set cookies),
 *             headers: Content-Type/Accept JSON, Origin, Referer matching browser.
 *
 * Form-fill is NOT implemented here — Workday application flow is a 6-step
 * wizard with anti-bot Cloudflare protection and would require dedicated work.
 *
 * Usage from scan: call `fetchAllJobs(tenant, sub, site)` to seed pipeline.md.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function getSession(tenant, sub, site) {
  const url = `https://${tenant}.${sub}.myworkdayjobs.com/${site}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const cookies = res.headers.getSetCookie?.() || res.headers.raw?.()?.['set-cookie'] || [];
  const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
  return { cookieStr, baseUrl: url };
}

export async function fetchAllJobs(tenant, sub, site, opts = {}) {
  const apiUrl = `https://${tenant}.${sub}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const { cookieStr, baseUrl } = await getSession(tenant, sub, site);
  const headers = {
    'User-Agent': UA,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': `https://${tenant}.${sub}.myworkdayjobs.com`,
    'Referer': baseUrl,
    ...(cookieStr ? { 'Cookie': cookieStr } : {}),
  };
  const out = [];
  let offset = 0;
  const limit = 20;
  while (true) {
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        appliedFacets: opts.facets || {},
        limit,
        offset,
        searchText: opts.search || '',
      }),
    });
    if (!r.ok) break;
    const data = await r.json();
    const batch = data.jobPostings || [];
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    if (offset > 1000) break;
  }
  return out.map(j => ({
    title: j.title,
    location: j.locationsText,
    url: `https://${tenant}.${sub}.myworkdayjobs.com${j.externalPath}`,
    postedOn: j.postedOn,
    bulletFields: j.bulletFields,
  }));
}

export async function probe(tenant, subs = ['wd1', 'wd3', 'wd5'], sites = ['Careers', 'External', 'Jobs']) {
  for (const sub of subs) {
    for (const site of sites) {
      try {
        const url = `https://${tenant}.${sub}.myworkdayjobs.com/${site}`;
        const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (r.ok) return { tenant, sub, site, url };
      } catch {}
    }
  }
  return null;
}
