#!/usr/bin/env node
import 'dotenv/config';
/**
 * Portal Inspector (review-mode).
 *
 *   node auto/inspect.mjs --opp-id <id> --url <portal-url>
 *
 * Opens a headed browser. User navigates manually. Script auto-captures
 * snapshots on URL change AND when user presses Enter in the terminal.
 * Type 'done' or close the browser to finish.
 *
 * Each snapshot:
 *   data/academic/inspections/<opp-id>/NN_<title-slug>.png   (full-page screenshot)
 *   data/academic/inspections/<opp-id>/NN_<title-slug>.md    (per-page report)
 *
 * On exit, writes:
 *   data/academic/inspections/<opp-id>/REPORT.md             (all captures merged)
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const args = { oppId: '', url: '', autoOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    if (a === '--opp-id') { args.oppId = n; i++; }
    else if (a === '--url') { args.url = n; i++; }
    else if (a === '--auto-only') { args.autoOnly = true; }
  }
  if (!args.oppId) { console.error('Required: --opp-id <slug>'); process.exit(1); }
  if (!args.url) { console.error('Required: --url <portal-url>'); process.exit(1); }
  return args;
}

function slugify(s) {
  return String(s || 'page').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'page';
}

const EXTRACT_SCRIPT = `() => {
  function isVisible(el) {
    let p = el;
    while (p && p.tagName !== 'BODY') {
      const s = window.getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      p = p.parentElement;
    }
    return true;
  }
  function labelFor(el) {
    if (el.id) {
      const l = document.querySelector('label[for="' + el.id.replace(/"/g, '\\\\"') + '"]');
      if (l) return l.textContent.trim();
    }
    const parent = el.closest('label, td, .sv-form-group, .form-group');
    if (parent) return parent.textContent.trim().slice(0, 200);
    let prev = el.previousElementSibling;
    while (prev && !prev.textContent?.trim()) prev = prev.previousElementSibling;
    return prev ? prev.textContent.trim().slice(0, 200) : '';
  }
  // Fields
  const fields = [];
  document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea').forEach(el => {
    if (!isVisible(el)) return;
    let selText = '';
    let options = [];
    if (el.tagName === 'SELECT') {
      options = Array.from(el.options).slice(0, 30).map(o => o.text.trim()).filter(Boolean);
      if (el.selectedIndex >= 0) selText = (el.options[el.selectedIndex] || {text:''}).text.trim();
    }
    fields.push({
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      name: el.name || '',
      id: el.id || '',
      label: labelFor(el).replace(/\\s+/g, ' '),
      value: (el.value || '').slice(0, 200),
      selectedText: selText,
      options: options,
      required: !!el.required || el.getAttribute('aria-required') === 'true',
      placeholder: el.placeholder || '',
      maxLength: el.maxLength > 0 ? el.maxLength : null,
    });
  });
  // Upload widgets — find file inputs + plupload widgets
  const uploads = [];
  document.querySelectorAll('input[type="file"]').forEach(el => {
    let title = '';
    const container = el.closest('[class*="upload"], [id*="upload"], [class*="plupload"], [id^="PLUP_uploader"]');
    if (container) {
      const titleEl = container.querySelector('h1, h2, h3, h4, .sv-panel-title, .panel-title, legend');
      title = titleEl ? titleEl.textContent.trim() : '';
    }
    if (!title) {
      const fs = el.closest('fieldset');
      if (fs) {
        const lg = fs.querySelector('legend, h2, h3');
        title = lg ? lg.textContent.trim() : '';
      }
    }
    const accept = el.accept || '';
    // Check if already filled (e.g. plupload filelist has content)
    let filled = false, filename = '';
    if (container) {
      const fl = container.querySelector('[id^="PLUP_filelist"], .file-list, .uploaded');
      if (fl) {
        const html = fl.innerHTML;
        filled = html.length > 30 && (html.includes('Successfully') || html.includes('.pdf') || html.includes('.jpg') || html.includes('.png'));
        const m = html.match(/[\\w_-]+\\.(?:pdf|jpg|jpeg|png|docx?)/i);
        if (m) filename = m[0];
      }
    }
    uploads.push({ title, accept, filled, filename, name: el.name || '', id: el.id || '' });
  });
  // Page context
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, legend, .sv-panel-title'))
    .filter(isVisible)
    .map(el => ({ level: el.tagName.toLowerCase(), text: el.textContent.trim() }))
    .filter(h => h.text);
  const mainText = Array.from(document.querySelectorAll('main p, .main p, article p, .sv-panel-body > p, form > p'))
    .filter(isVisible)
    .slice(0, 10)
    .map(el => el.textContent.trim())
    .filter(t => t.length > 20 && t.length < 600);
  return {
    url: window.location.href,
    title: document.title,
    fields,
    uploads,
    headings,
    paragraphs: mainText,
  };
}`;

function renderPageMd(data, n, screenshotRel) {
  const reqFields = data.fields.filter(f => f.required);
  const optFields = data.fields.filter(f => !f.required);
  const lines = [];
  lines.push(`# Page ${String(n).padStart(2, '0')}: ${data.title || '(no title)'}`);
  lines.push('');
  lines.push(`**URL**: ${data.url}`);
  lines.push('');
  lines.push(`![screenshot](${screenshotRel})`);
  lines.push('');
  if (data.headings.length) {
    lines.push(`## Headings on page`);
    for (const h of data.headings) lines.push(`- **${h.level}**: ${h.text}`);
    lines.push('');
  }
  if (data.paragraphs.length) {
    lines.push(`## Page text (instructions / context)`);
    for (const p of data.paragraphs) lines.push(`> ${p}`);
    lines.push('');
  }
  if (reqFields.length) {
    lines.push(`## ❗ Required fields (${reqFields.length})`);
    lines.push('');
    lines.push('| # | Label | Type | Current | Notes |');
    lines.push('|---|---|---|---|---|');
    reqFields.forEach((f, i) => {
      const cur = f.selectedText || f.value || '_(empty)_';
      const notes = [];
      if (f.options.length) notes.push(`options: ${f.options.slice(0, 8).join(' / ')}${f.options.length > 8 ? '...' : ''}`);
      if (f.maxLength) notes.push(`max ${f.maxLength} chars`);
      if (f.placeholder) notes.push(`hint: "${f.placeholder}"`);
      lines.push(`| ${i + 1} | ${f.label.slice(0, 100)} | ${f.tag}/${f.type} | ${cur.slice(0, 60)} | ${notes.join('; ')} |`);
    });
    lines.push('');
  }
  if (optFields.length) {
    lines.push(`## ⬜ Optional fields (${optFields.length})`);
    lines.push('');
    lines.push('| # | Label | Type | Current |');
    lines.push('|---|---|---|---|');
    optFields.slice(0, 30).forEach((f, i) => {
      const cur = f.selectedText || f.value || '_(empty)_';
      lines.push(`| ${i + 1} | ${f.label.slice(0, 100)} | ${f.tag}/${f.type} | ${cur.slice(0, 60)} |`);
    });
    lines.push('');
  }
  if (data.uploads.length) {
    lines.push(`## 📎 Upload widgets (${data.uploads.length})`);
    lines.push('');
    lines.push('| # | Widget title | Accepted | Status | Filename |');
    lines.push('|---|---|---|---|---|');
    data.uploads.forEach((u, i) => {
      lines.push(`| ${i + 1} | ${u.title || '(no title)'} | ${u.accept || 'any'} | ${u.filled ? '✅ FILLED' : '❌ EMPTY'} | ${u.filename || '—'} |`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

async function capture(page, dir, n) {
  const baseName = `${String(n).padStart(2, '0')}_${slugify(await page.title())}`;
  const pngPath = resolve(dir, `${baseName}.png`);
  const mdPath = resolve(dir, `${baseName}.md`);

  try {
    await page.screenshot({ path: pngPath, fullPage: true });
  } catch (e) {
    console.error(`  ! screenshot failed: ${e.message}`);
  }
  let data;
  try {
    data = await page.evaluate(EXTRACT_SCRIPT);
  } catch (e) {
    console.error(`  ! extract failed: ${e.message}`);
    return null;
  }
  const md = renderPageMd(data, n, `${baseName}.png`);
  writeFileSync(mdPath, md, 'utf-8');
  console.log(`  ✓ #${String(n).padStart(2, '0')} "${data.title.slice(0, 50)}" — ${data.fields.length} fields, ${data.uploads.length} uploads`);
  return { n, baseName, data };
}

function renderConsolidated(captures, oppId) {
  const lines = [];
  lines.push(`# Portal Inspection Report — ${oppId}`);
  lines.push('');
  lines.push(`**Captured**: ${new Date().toISOString()}`);
  lines.push(`**Total pages**: ${captures.length}`);
  lines.push(`**Total required fields across pages**: ${captures.reduce((acc, c) => acc + c.data.fields.filter(f => f.required).length, 0)}`);
  lines.push(`**Total upload widgets**: ${captures.reduce((acc, c) => acc + c.data.uploads.length, 0)}`);
  lines.push('');
  lines.push('## Table of contents');
  lines.push('');
  for (const c of captures) {
    lines.push(`- [Page ${String(c.n).padStart(2, '0')}: ${c.data.title.slice(0, 80)}](#page-${c.n.toString().padStart(2, '0')})`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  // Emit each page's content with anchors
  for (const c of captures) {
    lines.push(`<a id="page-${c.n.toString().padStart(2, '0')}"></a>`);
    lines.push('');
    const md = renderPageMd(c.data, c.n, `${c.baseName}.png`);
    lines.push(md);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const dir = resolve('data/academic/inspections', args.oppId);
  mkdirSync(dir, { recursive: true });

  console.log(`━━━ Portal Inspector ━━━`);
  console.log(`Opp ID:  ${args.oppId}`);
  console.log(`URL:     ${args.url}`);
  console.log(`Output:  ${dir}`);
  console.log('');
  console.log('Browser opens shortly. You navigate manually.');
  console.log('- Auto-captures on every URL change');
  console.log('- Press ENTER in this terminal to capture current page (e.g. after switching SITS tabs)');
  console.log('- Type "done" + ENTER to finish and generate report');
  console.log('- Closing the browser also finishes');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    locale: 'en-GB',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  const captures = [];
  let counter = 0;
  let lastUrl = '';
  let done = false;
  let stop = false;

  // Stdin handler
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf-8');
  let buffer = '';
  process.stdin.on('data', async (chunk) => {
    if (stop) return;
    for (const ch of chunk) {
      if (ch === '') { done = true; return; } // Ctrl+C
      if (ch === '\r' || ch === '\n') {
        const cmd = buffer.trim().toLowerCase();
        buffer = '';
        if (cmd === 'done' || cmd === 'q' || cmd === 'quit') { done = true; return; }
        // Manual capture
        stop = true;
        try {
          counter++;
          const c = await capture(page, dir, counter);
          if (c) captures.push(c);
        } catch (e) { console.error('  ! capture err:', e.message); }
        stop = false;
      } else if (ch === '') { // backspace
        buffer = buffer.slice(0, -1);
      } else {
        buffer += ch;
      }
    }
  });

  // Initial capture
  await new Promise(r => setTimeout(r, 3000));
  counter++;
  const first = await capture(page, dir, counter);
  if (first) { captures.push(first); lastUrl = first.data.url; }

  // URL polling loop
  while (!done) {
    await new Promise(r => setTimeout(r, 1500));
    if (page.isClosed()) { done = true; break; }
    let currentUrl;
    try { currentUrl = page.url(); } catch { done = true; break; }
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Settle wait
      await new Promise(r => setTimeout(r, 2500));
      stop = true;
      try {
        counter++;
        const c = await capture(page, dir, counter);
        if (c) captures.push(c);
      } catch (e) { console.error('  ! capture err:', e.message); }
      stop = false;
    }
  }

  // Reset terminal
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.removeAllListeners('data');

  console.log('');
  console.log('Writing consolidated report...');
  const report = renderConsolidated(captures, args.oppId);
  const reportPath = resolve(dir, 'REPORT.md');
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`✓ ${reportPath}`);
  console.log(`  ${captures.length} pages captured.`);

  try { await browser.close(); } catch {}
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
