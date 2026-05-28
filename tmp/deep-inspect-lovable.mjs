/**
 * Deep inspect: dump structure around resume, location, visa Yes/No fields
 * so we can see the actual selectors Lovable's Ashby form uses.
 */
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://jobs.ashbyhq.com/lovable/9f403111-c1e2-4f05-92a1-5a85cc5c8f61/application', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  function nodeInfo(el) {
    return {
      tag: el.tagName,
      type: el.type || '',
      id: el.id || '',
      name: el.name || '',
      cls: el.className?.toString?.().slice(0, 80) || '',
      placeholder: el.placeholder || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      role: el.getAttribute('role') || '',
      accept: el.accept || '',
      visible: !!(el.offsetParent || el.type === 'file'),
      display: window.getComputedStyle(el).display,
    };
  }

  const out = { resume: [], location: [], visa: [], buttonGroups: [] };

  // RESUME: any file inputs
  document.querySelectorAll('input[type="file"]').forEach(f => {
    const ctx = f.closest('div, fieldset, section');
    const labelText = ctx ? ctx.innerText.slice(0, 200).replace(/\s+/g, ' ').trim() : '';
    out.resume.push({
      info: nodeInfo(f),
      contextSnippet: labelText,
      parentTag: f.parentElement?.tagName,
      ancestorChain: chainUp(f, 4).map(e => `${e.tagName}.${(e.className?.toString?.() || '').slice(0, 40)}`),
    });
  });

  // LOCATION: typeahead inputs
  document.querySelectorAll('input').forEach(i => {
    const p = (i.placeholder || '').toLowerCase();
    if (p.includes('start typing') || p.includes('location') || p.includes('city')) {
      const ctx = i.closest('div, fieldset, section');
      out.location.push({
        info: nodeInfo(i),
        contextSnippet: ctx?.innerText.slice(0, 200).replace(/\s+/g, ' ').trim(),
        ancestorChain: chainUp(i, 4).map(e => `${e.tagName}.${(e.className?.toString?.() || '').slice(0, 40)}`),
      });
    }
  });

  // VISA buttons / Yes-No groups: scan all containers that have Yes AND No buttons
  document.querySelectorAll('div, fieldset, section').forEach(c => {
    const buttons = [...c.querySelectorAll('button')];
    const yes = buttons.find(b => /^Yes$/i.test(b.textContent.trim()));
    const no = buttons.find(b => /^No$/i.test(b.textContent.trim()));
    if (yes && no) {
      // Use closest title in this container
      const title = c.querySelector('label, h2, h3, h4, .ashby-application-form-question-title, [class*="question-title"], [class*="QuestionTitle"]');
      out.buttonGroups.push({
        containerTag: c.tagName,
        containerCls: c.className?.toString?.().slice(0, 80),
        title: title?.innerText.trim().slice(0, 150),
        titleCls: title?.className?.toString?.().slice(0, 80),
        yesBtnInfo: { cls: yes.className?.toString?.().slice(0, 60), text: yes.textContent.trim() },
        noBtnInfo: { cls: no.className?.toString?.().slice(0, 60), text: no.textContent.trim() },
        snippet: c.innerText.slice(0, 200).replace(/\s+/g, ' ').trim(),
      });
    }
  });

  function chainUp(el, depth) {
    const chain = [];
    let p = el;
    for (let i = 0; i < depth && p; i++) {
      chain.push(p);
      p = p.parentElement;
    }
    return chain;
  }

  // Dedupe buttonGroups (deeply nested ancestors all match)
  const seen = new Set();
  out.buttonGroups = out.buttonGroups.filter(bg => {
    const k = `${bg.title}::${bg.snippet.slice(0, 80)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return out;
});

console.log(JSON.stringify(dump, null, 2));
await browser.close();
