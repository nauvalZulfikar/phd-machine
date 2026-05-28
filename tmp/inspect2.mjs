import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://jobs.ashbyhq.com/synthesia/a40cbbc3-6be7-48a2-b8c7-1f09a1c5aa43/application', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const allInputs = await page.evaluate(() =>
  [...document.querySelectorAll('input, textarea, select, button')].map((el, i) => ({
    i,
    tag: el.tagName,
    type: el.type,
    name: el.name,
    id: el.id,
    placeholder: el.placeholder,
    accept: el.accept,
    text: (el.innerText || '').slice(0, 60),
    visible: !!el.offsetParent || el.type === 'file',
  }))
);
console.log(JSON.stringify(allInputs, null, 2));
await browser.close();
