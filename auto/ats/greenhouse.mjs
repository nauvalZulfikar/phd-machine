/**
 * Greenhouse adapter.
 *
 * Job URL pattern: https://job-boards(.eu)?.greenhouse.io/<board>/jobs/<id>
 * API: https://boards-api.greenhouse.io/v1/boards/<board>/jobs/<id>
 *
 * Form characteristics:
 * - Names split into first_name / last_name.
 * - Custom Qs use IDs like `question_<digits>` (text inputs and selects).
 * - Dropdowns rendered as custom widgets (input + listbox); detect via aria-* roles.
 * - Resume + cover letter file inputs use `id="resume"` and `id="cover_letter"`.
 * - Phone is required on most boards.
 * - Submit button text: "Submit application".
 * - After submit, page navigates to a thank-you URL or shows confirmation div.
 */
import { BaseAdapter, helpers } from './base.mjs';

export class GreenhouseAdapter extends BaseAdapter {
  constructor(url, ctx) {
    super(url, ctx);
    this.type = 'greenhouse';
    const m = url.match(/(job-boards|boards)(\.eu)?\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
    if (!m) throw new Error(`Bad Greenhouse URL: ${url}`);
    this.boardHost = `${m[1]}${m[2] || ''}.greenhouse.io`;
    this.boardSlug = m[3];
    this.jobId = m[4];
    this.applyUrl = url;
  }

  async fetchJobMeta() {
    // Greenhouse API is single global host — `boards-api.eu.greenhouse.io` does
    // NOT exist (NXDOMAIN). All boards (US + EU) resolve via boards-api.greenhouse.io.
    const url = `https://boards-api.greenhouse.io/v1/boards/${this.boardSlug}/jobs/${this.jobId}?questions=true`;
    const res = await fetch(url);
    const job = await res.json();
    return {
      ats: 'greenhouse',
      title: job.title,
      company: prettyCompany(this.boardSlug),
      location: job.location?.name || '',
      department: job.departments?.[0]?.name || '',
      jdHtml: job.content,
      jdText: (job.content || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim(),
      jobUrl: job.absolute_url,
      applyUrl: job.absolute_url,
    };
  }

  async inspectForm(page) {
    await page.goto(this.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);

    // Click the "Apply" CTA if present (Greenhouse sometimes lazy-loads form)
    const applyBtn = page.getByRole('button', { name: /^apply$/i });
    if (await applyBtn.count() > 0) {
      try { await applyBtn.first().click(); await page.waitForTimeout(2000); } catch {}
    }

    const fields = await page.evaluate(() => {
      const out = [];
      // Inputs with associated labels
      document.querySelectorAll('input, textarea, select').forEach(ctrl => {
        if (ctrl.type === 'hidden' || ctrl.type === 'submit' || ctrl.type === 'button') return;
        if (!ctrl.id && !ctrl.name) return;
        const labelEl = ctrl.labels?.[0]
          || document.querySelector(`label[for="${ctrl.id}"]`);
        const label = (labelEl?.innerText || ctrl.getAttribute('aria-label') || ctrl.placeholder || '').trim().replace(/\s+/g, ' ');
        if (!label && ctrl.id !== 'resume' && ctrl.id !== 'cover_letter') return;

        const type = (() => {
          if (ctrl.type === 'file') return 'file';
          if (ctrl.type === 'email') return 'email';
          if (ctrl.type === 'tel') return 'tel';
          if (ctrl.type === 'url') return 'url';
          if (ctrl.tagName === 'TEXTAREA') return 'textarea';
          if (ctrl.tagName === 'SELECT') return 'select';
          if (ctrl.type === 'checkbox') return 'checkbox';
          if (ctrl.type === 'radio') return 'radio';
          // Greenhouse renders dropdowns as text input with role=combobox
          if (ctrl.getAttribute('role') === 'combobox' || ctrl.getAttribute('aria-autocomplete') === 'list') return 'select-combobox';
          return 'text';
        })();

        // Heuristic: country field renders as typeahead
        const lower = (label + ' ' + (ctrl.id || '')).toLowerCase();
        const finalType = (lower.includes('country') && type === 'text') ? 'typeahead' : type;

        out.push({
          id: ctrl.id || ctrl.name,
          label: label.replace(/\*$/, '').trim(),
          type: finalType,
          required: ctrl.required || /\*$/.test(label || ''),
          selectorHint: ctrl.id ? `#${ctrl.id}` : `[name="${ctrl.name}"]`,
        });
      });
      return out;
    });
    return fields;
  }

  async fillForm(page, schema, answers, files) {
    if (!page.url().includes(this.applyUrl.replace(/\?.*$/, ''))) {
      await page.goto(this.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000);
    }
    for (const field of schema) {
      const value = pickAnswer(field, answers);
      if (value === undefined || value === null || value === '') {
        if (field.required) console.log(`  ⚠ ${field.label}: REQUIRED but no answer`);
        continue;
      }
      try {
        const ctrl = page.locator(`[id="${field.id}"]`).first();
        switch (field.type) {
          case 'file': {
            const fp = /cover[_ ]?letter/i.test(field.id) ? files.clPath : files.cvPath;
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
          case 'select-combobox':
          case 'typeahead': {
            await ctrl.click();
            await ctrl.fill(String(value));
            await page.waitForTimeout(900);
            // Try to pick matching option
            const opt = page.locator('[role="option"], li, [role="listbox"] *')
              .filter({ hasText: new RegExp(String(value), 'i') })
              .first();
            if ((await opt.count()) > 0) await opt.click();
            else await page.keyboard.press('Tab');
            break;
          }
          case 'checkbox':
          case 'radio': {
            if (value === true || /^yes$/i.test(String(value))) await ctrl.check({ force: true });
            else await ctrl.uncheck({ force: true });
            break;
          }
          default:
            await ctrl.fill(String(value));
        }
        console.log(`  ✓ ${field.label}: ${truncate(String(value), 60)}`);
      } catch (err) {
        console.log(`  ✗ ${field.label} (${field.type}): ${err.message}`);
      }
    }
    await page.waitForTimeout(1000);
  }

  async submit(page) {
    const btn = page.getByRole('button', { name: /submit application/i }).last();
    await btn.click();
    let success = false, confirmationText = '';
    try {
      await Promise.race([
        page.waitForURL(/thanks|thank-you|application-submitted|confirmation/i, { timeout: 30_000 }),
        page.waitForSelector('text=/thank you|application.* (received|submitted)|we.ve received|success/i', { timeout: 30_000 }),
      ]);
      success = true;
      const body = await page.locator('body').innerText();
      confirmationText = body.split('\n').filter(Boolean).slice(0, 6).join('\n');
    } catch {
      success = false;
      confirmationText = (await page.locator('body').innerText()).slice(0, 500);
    }
    return { success, confirmationText, finalUrl: page.url() };
  }
}

function prettyCompany(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function pickAnswer(field, answers) {
  if (answers[field.id] !== undefined) return answers[field.id];
  const labelLower = field.label.toLowerCase();
  // Exact label match first
  for (const [k, v] of Object.entries(answers)) {
    if (k.toLowerCase() === labelLower) return v;
  }
  // Substring match
  for (const [k, v] of Object.entries(answers)) {
    if (labelLower.includes(k.toLowerCase()) || k.toLowerCase().includes(labelLower)) return v;
  }
  return undefined;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}
