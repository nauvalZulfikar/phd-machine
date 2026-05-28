/**
 * Shared headless browser for academic source scrapers.
 *
 *   const { page, close } = await getPage();
 *   await page.goto(...);
 *   ...
 *   await close();
 *
 * One Chromium instance per Node process. Each call returns a fresh page.
 */

import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
let _browser = null;
let _context = null;
let _pages = 0;

async function ensureBrowser() {
  if (_browser) return _browser;
  const headless = process.env.HEADLESS !== 'false';
  _browser = await chromium.launch({
    headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });
  _context = await _browser.newContext({
    userAgent: UA,
    viewport: { width: 1400, height: 900 },
    locale: 'en-GB',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  // Hide navigator.webdriver
  await _context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return _browser;
}

export async function getPage() {
  await ensureBrowser();
  const page = await _context.newPage();
  _pages++;
  const close = async () => {
    try { await page.close(); } catch {}
    _pages--;
    if (_pages === 0) {
      try { await _context.close(); } catch {}
      try { await _browser.close(); } catch {}
      _browser = null;
      _context = null;
    }
  };
  return { page, close };
}

export async function shutdownBrowser() {
  try { if (_context) await _context.close(); } catch {}
  try { if (_browser) await _browser.close(); } catch {}
  _browser = null;
  _context = null;
  _pages = 0;
}
