import { chromium } from 'playwright';
import { resolve } from 'path';
const b = await chromium.launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
await p.goto('file:///' + resolve('dashboard.html').replace(/\\/g, '/'));
await p.waitForTimeout(800);
// Expand the first run for visual confirmation
await p.locator('details.run').first().evaluate(el => el.open = true);
await p.waitForTimeout(500);
await p.screenshot({ path: 'tmp/dashboard-preview.png', fullPage: true });
console.log('tmp/dashboard-preview.png');
await b.close();
