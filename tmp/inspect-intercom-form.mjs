import { chromium } from 'playwright';

const APPLY_URL = 'https://job-boards.greenhouse.io/intercom/jobs/7314809';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(APPLY_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

// Click "Apply" if it's a separate landing page
const applyBtn = page.getByRole('button', { name: /^apply$/i }).or(page.locator('a', { hasText: /^apply$/i }));
if (await applyBtn.count() > 0) {
  try { await applyBtn.first().click(); await page.waitForTimeout(2000); } catch {}
}

const fields = await page.evaluate(() => {
  return [...document.querySelectorAll('input, textarea, select, button')].map((el, i) => ({
    i,
    tag: el.tagName,
    type: el.type || '',
    name: el.name || '',
    id: el.id || '',
    placeholder: el.placeholder || '',
    label: (el.labels?.[0]?.innerText || '').slice(0, 80),
    text: (el.innerText || '').slice(0, 50),
    required: el.required || false,
    visible: !!el.offsetParent || el.type === 'file' || el.type === 'hidden',
  }));
});

console.log(JSON.stringify(fields.filter(f => f.visible !== false), null, 2));
await page.screenshot({ path: 'tmp/intercom-form.png', fullPage: true });
console.log('Screenshot: tmp/intercom-form.png');
await browser.close();
