import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { getPage, shutdownBrowser } from './_browser.mjs';

const TMP = resolve('tmp/findaphd-debug');
mkdirSync(TMP, { recursive: true });

const url = 'https://www.findaphd.com/funded-phd-projects/?Keywords=digital%20twin%20logistics';

const { page, close } = await getPage();
console.log('Going to:', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

for (let i = 1; i <= 20; i++) {
  await page.waitForTimeout(1500);
  const title = await page.title();
  const linkCount = await page.evaluate(() => document.querySelectorAll('a[href*="/phds/project/"]').length);
  console.log(`[${i}] title="${title.slice(0,60)}" links=${linkCount}`);
  if (linkCount > 0) break;
  // Save snapshot every 5 iterations
  if (i % 5 === 0) {
    await page.screenshot({ path: resolve(TMP, `s_${i}.png`), fullPage: false });
    const html = await page.content();
    writeFileSync(resolve(TMP, `s_${i}.html`), html.slice(0, 50_000), 'utf-8');
  }
}

await page.screenshot({ path: resolve(TMP, 'final.png'), fullPage: false });
const html = await page.content();
writeFileSync(resolve(TMP, 'final.html'), html, 'utf-8');
console.log(`Saved final to ${TMP}/final.html`);

await close();
await shutdownBrowser();
