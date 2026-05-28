import { chromium } from 'playwright';

const APPLY_URL = 'https://jobs.ashbyhq.com/synthesia/a40cbbc3-6be7-48a2-b8c7-1f09a1c5aa43/application';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(APPLY_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const fields = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('label').forEach(label => {
    const text = (label.innerText || '').trim();
    if (!text) return;
    const forId = label.getAttribute('for');
    let ctrl = forId ? document.getElementById(forId) : label.querySelector('input,textarea,select');
    if (!ctrl) {
      const next = label.nextElementSibling;
      if (next && (next.tagName === 'INPUT' || next.tagName === 'TEXTAREA' || next.tagName === 'SELECT' || next.querySelector('input,textarea,select'))) {
        ctrl = next.tagName === 'INPUT' || next.tagName === 'TEXTAREA' || next.tagName === 'SELECT' ? next : next.querySelector('input,textarea,select');
      }
    }
    out.push({
      label: text,
      tag: ctrl?.tagName || null,
      type: ctrl?.type || null,
      name: ctrl?.name || ctrl?.id || null,
      required: ctrl?.required || label.innerText.includes('*'),
    });
  });
  // Also collect any standalone selects, textareas, checkboxes without proper label
  document.querySelectorAll('select, textarea, input[type="checkbox"], input[type="radio"]').forEach(c => {
    if (!c.id) return;
    if (![...document.querySelectorAll(`label[for="${c.id}"]`)].length) {
      out.push({ label: '(unlabelled)', tag: c.tagName, type: c.type, name: c.name || c.id, required: c.required });
    }
  });
  return out;
});

console.log(JSON.stringify(fields, null, 2));
await page.screenshot({ path: 'tmp/synthesia-apply-page.png', fullPage: true });
console.log('\nScreenshot saved to tmp/synthesia-apply-page.png');
await browser.close();
