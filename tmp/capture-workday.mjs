import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
let capturedReq = null;
let capturedResp = null;
p.on('request', async (r) => {
  if (r.url().includes('/wday/cxs/grab/Careers/jobs') && r.method() === 'POST') {
    capturedReq = {
      url: r.url(),
      headers: r.headers(),
      postData: r.postData(),
    };
  }
});
p.on('response', async (r) => {
  if (r.url().includes('/wday/cxs/grab/Careers/jobs') && r.request().method() === 'POST') {
    try { capturedResp = await r.json(); } catch {}
  }
});
await p.goto('https://grab.wd3.myworkdayjobs.com/Careers', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(5000);
console.log('REQUEST');
console.log('  url:', capturedReq?.url);
console.log('  body:', capturedReq?.postData);
console.log('  headers:');
for (const [k,v] of Object.entries(capturedReq?.headers || {})) {
  if (/^(x-|content|cookie|origin|referer|user-agent|accept)/i.test(k)) console.log(`    ${k}: ${v}`);
}
console.log('\nRESPONSE total:', capturedResp?.total);
console.log('First 3 titles:');
(capturedResp?.jobPostings||[]).slice(0,3).forEach(j => console.log(' -', j.title, '|', j.locationsText));
await b.close();
