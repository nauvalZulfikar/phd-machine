/**
 * Fase 6: Fill Synthesia Commercial DS form, screenshot, STOP before submit.
 * Pass --submit to actually click the Submit button (Fase 8).
 */
import { chromium } from 'playwright';
import { resolve } from 'path';

const APPLY_URL = 'https://jobs.ashbyhq.com/synthesia/a40cbbc3-6be7-48a2-b8c7-1f09a1c5aa43/application';
const CV_PDF = resolve('output/cv-synthesia-commercial-ds.pdf');
const CL_PDF = resolve('output/cl-synthesia-commercial-ds.pdf');
const SHOULD_SUBMIT = process.argv.includes('--submit');

const browser = await chromium.launch({ headless: !SHOULD_SUBMIT });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

console.log(`▶ Opening ${APPLY_URL}`);
await page.goto(APPLY_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// --- Name ---
console.log('▶ Name');
await page.locator('#_systemfield_name').fill('Nauval Zulfikar');

// --- Email ---
console.log('▶ Email');
await page.locator('#_systemfield_email').fill('zulfikar.nauval1998@gmail.com');

// --- Resume upload (selector uses #id, not [name]) ---
console.log('▶ Resume upload');
await page.locator('#_systemfield_resume').setInputFiles(CV_PDF);
await page.waitForTimeout(2000);

// --- Cover Letter upload ---
console.log('▶ Cover Letter upload');
await page.locator('#\\31 7b7f928-0e08-4041-9b0a-e20bcd0e600d').setInputFiles(CL_PDF);
await page.waitForTimeout(2000);

// --- LinkedIn ---
console.log('▶ LinkedIn');
await page.locator('#\\34 a29ef41-ea92-41cb-af41-a8044fb38373').fill('https://linkedin.com/in/nauval-zulfikar');

// --- Location (typeahead) ---
console.log('▶ Location (typeahead)');
const locationInput = page.getByPlaceholder(/start typing/i).first();
await locationInput.fill('Milan');
await page.waitForTimeout(1200);
const milanOption = page.locator('li,div,button').filter({ hasText: /^Milan, Italy/i }).first();
if ((await milanOption.count()) > 0) {
  await milanOption.click();
  console.log('   → Selected "Milan, Italy" from autocomplete');
} else {
  console.log('   ⚠ No autocomplete match, keeping typed value');
  await locationInput.fill('Milan, Italy');
  await page.keyboard.press('Tab');
}

// --- Visa Q1: legally authorised without sponsorship → YES ---
console.log('▶ Visa Q1 (authorised without sponsorship) → Yes');
const yesButtons = page.getByRole('button', { name: /^Yes$/ });
await yesButtons.nth(0).click();

// --- Visa Q2: ongoing employer support → NO ---
console.log('▶ Visa Q2 (need ongoing employer support) → No');
const noButtons = page.getByRole('button', { name: /^No$/ });
await noButtons.nth(1).click();

await page.waitForTimeout(1500);

// --- Screenshot ---
console.log('▶ fullPage screenshot');
await page.screenshot({ path: 'tmp/synthesia-form-filled.png', fullPage: true });

if (!SHOULD_SUBMIT) {
  console.log('\n✅ Form filled. Screenshot: tmp/synthesia-form-filled.png');
  console.log('   NOT submitted. Re-run with --submit to actually submit.');
  await browser.close();
  process.exit(0);
}

// --- SUBMIT (Fase 8 only) ---
console.log('\n▶▶▶ SUBMITTING — Fase 8 ▶▶▶');
const submitBtn = page.getByRole('button', { name: /^(submit|apply|submit application)$/i }).last();
const beforeUrl = page.url();
await submitBtn.click();
console.log('   Clicked Submit. Waiting for confirmation...');

try {
  await Promise.race([
    page.waitForURL((url) => url.toString() !== beforeUrl, { timeout: 30_000 }),
    page.waitForSelector('text=/thank you|received|submitted|application sent|we.ve received/i', { timeout: 30_000 }),
  ]);
} catch {
  console.log('   ⚠ No URL change / success text within 30s — capturing current state.');
}

await page.waitForTimeout(2500);
const finalUrl = page.url();
console.log(`   Final URL: ${finalUrl}`);
await page.screenshot({ path: 'tmp/synthesia-confirmation.png', fullPage: true });

const bodyText = await page.locator('body').innerText();
const fs = await import('fs/promises');
await fs.writeFile('tmp/synthesia-confirmation.txt', `URL: ${finalUrl}\n\n${bodyText}`);

console.log('\n✅ Submitted. Confirmation captured:');
console.log('   - Screenshot: tmp/synthesia-confirmation.png');
console.log('   - Text:       tmp/synthesia-confirmation.txt');
console.log(`   - Final URL:  ${finalUrl}`);

await page.waitForTimeout(2000);
await browser.close();
