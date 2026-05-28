import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:4280/', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
// Crop to just the Sankey panel for prominent visual
const sankey = p.locator('.sankey-panel');
await sankey.screenshot({ path: 'tmp/dashboard-sankey.png' });
await p.locator('details.run').first().evaluate(el => el.open = true);
await p.waitForTimeout(400);
await p.screenshot({ path: 'tmp/dashboard-localhost.png', fullPage: true });
console.log('saved: tmp/dashboard-sankey.png + tmp/dashboard-localhost.png');
await b.close();
