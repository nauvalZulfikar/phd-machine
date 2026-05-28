/**
 * Lever adapter.
 *
 * Job URL: https://jobs.lever.co/<board>/<id>
 * Apply URL: https://jobs.lever.co/<board>/<id>/apply
 * Public posting JSON: https://api.lever.co/v0/postings/<board>/<id>
 *
 * Form characteristics:
 * - Posts to standard form action; minimal client-side framework on simple boards.
 * - Resume upload + cover letter upload (both file).
 * - "Full name" single field; phone number; LinkedIn URL.
 * - Custom questions: text inputs grouped under section headings.
 * - Demographic Qs typically optional, dropdown style.
 * - Submit: form submit (button text "Apply").
 */
import { BaseAdapter, helpers } from './base.mjs';

export class LeverAdapter extends BaseAdapter {
  constructor(url, ctx) {
    super(url, ctx);
    this.type = 'lever';
    const m = url.match(/jobs\.lever\.co\/([^/]+)\/([\w-]+)/);
    if (!m) throw new Error(`Bad Lever URL: ${url}`);
    this.board = m[1];
    this.jobId = m[2];
    this.applyUrl = url.endsWith('/apply') ? url : `${url}/apply`;
  }

  async fetchJobMeta() {
    const res = await fetch(`https://api.lever.co/v0/postings/${this.board}/${this.jobId}`);
    const job = await res.json();
    return {
      ats: 'lever',
      title: job.text,
      company: prettyCompany(this.board),
      location: job.categories?.location || '',
      department: job.categories?.team || '',
      jdHtml: job.description,
      jdText: (job.descriptionPlain || job.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      jobUrl: job.hostedUrl,
      applyUrl: `${job.hostedUrl}/apply`,
    };
  }

  async inspectForm(page) {
    await page.goto(this.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
    const fields = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('input, textarea, select').forEach(ctrl => {
        if (ctrl.type === 'hidden' || ctrl.type === 'submit') return;
        const label =
          (ctrl.labels?.[0]?.innerText || '').trim()
          || (document.querySelector(`label[for="${ctrl.id}"]`)?.innerText || '').trim()
          || ctrl.placeholder
          || ctrl.getAttribute('aria-label')
          || '';
        if (!label && !ctrl.name) return;
        const type = (() => {
          if (ctrl.type === 'file') return 'file';
          if (ctrl.type === 'email') return 'email';
          if (ctrl.type === 'tel') return 'tel';
          if (ctrl.type === 'url') return 'url';
          if (ctrl.tagName === 'TEXTAREA') return 'textarea';
          if (ctrl.tagName === 'SELECT') return 'select';
          if (ctrl.type === 'checkbox') return 'checkbox';
          if (ctrl.type === 'radio') return 'radio';
          return 'text';
        })();
        out.push({
          id: ctrl.id || ctrl.name,
          label: label.replace(/\*$/, '').trim().replace(/\s+/g, ' '),
          type,
          required: ctrl.required || /\*$/.test(label || ''),
          selectorHint: ctrl.id ? `#${ctrl.id}` : `[name="${ctrl.name}"]`,
        });
      });
      return out;
    });
    return fields;
  }

  async fillForm(page, schema, answers, files) {
    for (const field of schema) {
      const value = pickAnswer(field, answers);
      if (value === undefined || value === null || value === '') {
        if (field.required) console.log(`  ⚠ ${field.label}: REQUIRED but no answer`);
        continue;
      }
      try {
        const sel = field.id.startsWith('idx-') ? `[name="${field.id}"]` : `[id="${field.id}"], [name="${field.id}"]`;
        const ctrl = page.locator(sel).first();
        switch (field.type) {
          case 'file': {
            const fp = /cover[_ ]?letter/i.test(field.label) ? files.clPath : files.cvPath;
            if (fp) await ctrl.setInputFiles(fp);
            await page.waitForTimeout(1500);
            break;
          }
          case 'select': {
            await ctrl.selectOption({ label: String(value) }).catch(async () => {
              await ctrl.selectOption(String(value));
            });
            break;
          }
          case 'checkbox': {
            if (value === true || /^yes$/i.test(String(value))) await ctrl.check();
            else await ctrl.uncheck();
            break;
          }
          case 'radio': {
            await ctrl.check();
            break;
          }
          default:
            await ctrl.fill(String(value));
        }
        console.log(`  ✓ ${field.label}: ${truncate(String(value), 60)}`);
      } catch (err) {
        console.log(`  ✗ ${field.label}: ${err.message}`);
      }
    }
    await page.waitForTimeout(1000);
  }

  async submit(page) {
    const btn = page.getByRole('button', { name: /^(submit|apply|submit application)$/i }).last();
    await btn.click();
    let success = false, confirmationText = '';
    try {
      await Promise.race([
        page.waitForURL(/thanks|complete|submitted/i, { timeout: 30_000 }),
        page.waitForSelector('text=/thank you|received|submitted|success/i', { timeout: 30_000 }),
      ]);
      success = true;
      confirmationText = (await page.locator('body').innerText()).split('\n').filter(Boolean).slice(0, 6).join('\n');
    } catch {
      success = false;
      confirmationText = (await page.locator('body').innerText()).slice(0, 500);
    }
    return { success, confirmationText, finalUrl: page.url() };
  }
}

function prettyCompany(b) { return b.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function pickAnswer(field, answers) {
  if (answers[field.id] !== undefined) return answers[field.id];
  const ll = field.label.toLowerCase();
  for (const [k, v] of Object.entries(answers)) {
    if (ll.includes(k.toLowerCase()) || k.toLowerCase().includes(ll)) return v;
  }
  return undefined;
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s; }
