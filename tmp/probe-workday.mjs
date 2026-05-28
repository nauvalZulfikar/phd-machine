import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();

const targets = [
  { co: 'Grab', url: 'https://grab.wd3.myworkdayjobs.com/Careers' },
  { co: 'GoTo', url: 'https://gotogroup.wd3.myworkdayjobs.com/External' },
  { co: 'Gojek', url: 'https://gojektech.wd3.myworkdayjobs.com/External' },
  { co: 'Tokopedia', url: 'https://tokopedia.wd3.myworkdayjobs.com/External' },
  { co: 'Shopee', url: 'https://shopee.wd3.myworkdayjobs.com/External' },
];

const apiCalls = [];
p.on('response', async (r) => {
  const u = r.url();
  if (u.includes('/wday/cxs/') && u.includes('/jobs') && r.request().method() === 'POST') {
    apiCalls.push({ url: u, status: r.status() });
  }
});

for (const t of targets) {
  apiCalls.length = 0;
  try {
    await p.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await p.waitForTimeout(4000);
    // count visible job tiles
    const count = await p.evaluate(() => {
      const txt = document.body.innerText;
      const m = txt.match(/(\d+)\s+(jobs|results|opportunities)/i);
      return { match: m?.[0], itemsLen: document.querySelectorAll('[data-automation-id*="job"], a[href*="/job/"]').length };
    });
    console.log(`✓ ${t.co.padEnd(10)} | ${t.url}`);
    console.log(`  jobs text: ${count.match || '(none)'}, tiles: ${count.itemsLen}, API calls: ${apiCalls.length}`);
    if (apiCalls.length) console.log(`  api: ${apiCalls[0].url} → ${apiCalls[0].status}`);
  } catch (e) {
    console.log(`✗ ${t.co}: ${e.message.split('\n')[0]}`);
  }
}
await b.close();
