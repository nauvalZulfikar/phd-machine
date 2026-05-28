/**
 * Ashby adapter.
 *
 * Job URL pattern: https://jobs.ashbyhq.com/<board>/<uuid>
 * Apply URL pattern: <job-url>/application
 * Public API: https://api.ashbyhq.com/posting-api/job-board/<board>?includeCompensation=true
 *
 * Form characteristics:
 * - Resume and cover letter inputs use `id` (not `name`).
 * - Visa-style binary Qs are rendered as Yes/No <button>s, not checkboxes.
 * - Location is a typeahead.
 * - Success is shown in-place (no URL change) — detect via "Success" text.
 */
import { BaseAdapter, helpers } from './base.mjs';

export class AshbyAdapter extends BaseAdapter {
  constructor(url, ctx) {
    super(url, ctx);
    this.type = 'ashby';
    const m = url.match(/jobs\.ashbyhq\.com\/([^/]+)\/([\w-]+)/);
    if (!m) throw new Error(`Bad Ashby URL: ${url}`);
    this.board = m[1];
    this.jobId = m[2];
    this.applyUrl = url.endsWith('/application') ? url : `${url}/application`;
  }

  async fetchJobMeta() {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${this.board}?includeCompensation=true`);
    const data = await res.json();
    const job = (data.jobs || []).find(j => j.id === this.jobId);
    if (!job) throw new Error(`Job ${this.jobId} not found on Ashby board ${this.board}`);
    return {
      ats: 'ashby',
      title: job.title,
      company: prettyCompany(this.board),
      location: job.location,
      isRemote: job.isRemote,
      workplaceType: job.workplaceType,
      department: job.department,
      jdHtml: job.descriptionHtml,
      jdText: job.descriptionPlain,
      jobUrl: job.jobUrl,
      applyUrl: job.applyUrl || this.applyUrl,
    };
  }

  async inspectForm(page) {
    await page.goto(this.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2500);
    const fields = await page.evaluate(() => {
      const out = [];

      // Ashby wraps each form field in `.ashby-application-form-field-entry`.
      // Walk each entry, identify its title and its input element(s).
      const entries = document.querySelectorAll('.ashby-application-form-field-entry');

      entries.forEach((entry, entryIdx) => {
        const titleEl = entry.querySelector('.ashby-application-form-question-title, [class*="_heading_"], [class*="_label_"]');
        let title = titleEl?.innerText?.trim().replace(/\s+/g, ' ').replace(/\s*\*$/, '').trim() || '';
        if (!title) {
          // Fallback: input's own label or placeholder
          const anyInput = entry.querySelector('input, textarea, select');
          title = anyInput?.placeholder || anyInput?.getAttribute('aria-label') || `(field ${entryIdx})`;
        }
        const required = !!entry.querySelector('[class*="_required_"]') || /\*\s*$/.test(titleEl?.innerText || '');

        // Detect the right input element for this entry. Order matters.
        const fileInput = entry.querySelector('input[type="file"]');
        const yesBtn = [...entry.querySelectorAll('button')].find(b => /^Yes$/i.test(b.textContent.trim()));
        const noBtn = [...entry.querySelectorAll('button')].find(b => /^No$/i.test(b.textContent.trim()));
        const radioInputs = entry.querySelectorAll('input[type="radio"]');
        const checkboxInput = entry.querySelector('input[type="checkbox"]');
        const textarea = entry.querySelector('textarea');
        const selectEl = entry.querySelector('select');
        const combobox = entry.querySelector('input[role="combobox"], input[placeholder*="Start typing" i]');
        const otherInput = entry.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="url"]');

        if (fileInput) {
          out.push({
            id: fileInput.id || `idx-file-${entryIdx}`,
            label: title,
            type: 'file',
            required,
            selectorHint: fileInput.id ? `[id="${fileInput.id}"]` : null,
            entryIdx,
          });
          return;
        }
        if (yesBtn && noBtn) {
          out.push({
            id: `btnq-${entryIdx}`,
            label: title,
            type: 'button-toggle',
            required,
            selectorHint: null,
            entryIdx,
          });
          return;
        }
        if (radioInputs.length > 0) {
          const opts = [...radioInputs].map(r => {
            const lbl = r.labels?.[0]?.innerText?.trim()
              || document.querySelector(`label[for="${r.id}"]`)?.innerText?.trim()
              || r.value || '';
            return { value: r.value || lbl, label: lbl, id: r.id };
          });
          out.push({
            id: radioInputs[0].name || `rg-${entryIdx}`,
            label: title,
            type: 'radio-group',
            required,
            options: opts,
            selectorHint: radioInputs[0].name ? `[name="${radioInputs[0].name}"]` : null,
            entryIdx,
          });
          return;
        }
        if (textarea) {
          out.push({
            id: textarea.id || textarea.name || `idx-ta-${entryIdx}`,
            label: title,
            type: 'textarea',
            required,
            selectorHint: textarea.id ? `[id="${textarea.id}"]` : (textarea.name ? `[name="${textarea.name}"]` : null),
            entryIdx,
          });
          return;
        }
        if (selectEl) {
          out.push({
            id: selectEl.id || selectEl.name,
            label: title,
            type: 'select',
            required,
            selectorHint: selectEl.id ? `[id="${selectEl.id}"]` : `[name="${selectEl.name}"]`,
            entryIdx,
          });
          return;
        }
        if (combobox) {
          out.push({
            id: combobox.id || `idx-cb-${entryIdx}`,
            label: title,
            type: 'typeahead',
            required,
            selectorHint: combobox.id ? `[id="${combobox.id}"]` : `.ashby-application-form-field-entry:nth-of-type(${entryIdx + 1}) input[role="combobox"], .ashby-application-form-field-entry:nth-of-type(${entryIdx + 1}) input[placeholder*="Start typing" i]`,
            entryIdx,
          });
          return;
        }
        if (checkboxInput) {
          out.push({
            id: checkboxInput.id || checkboxInput.name,
            label: title,
            type: 'checkbox',
            required,
            selectorHint: checkboxInput.id ? `[id="${checkboxInput.id}"]` : `[name="${checkboxInput.name}"]`,
            entryIdx,
          });
          return;
        }
        if (otherInput) {
          const subType = otherInput.type === 'email' ? 'email'
            : otherInput.type === 'tel' ? 'tel'
            : otherInput.type === 'url' ? 'url'
            : 'text';
          out.push({
            id: otherInput.id || otherInput.name || `idx-t-${entryIdx}`,
            label: title,
            type: subType,
            required,
            selectorHint: otherInput.id ? `[id="${otherInput.id}"]` : (otherInput.name ? `[name="${otherInput.name}"]` : null),
            entryIdx,
          });
          return;
        }
      });

      // Fallback pass A: catch inputs/textareas/checkboxes whose container is NOT
      // `.ashby-application-form-field-entry` but is in the application form.
      const usedIds = new Set(out.map(f => f.id));
      const form = document.querySelector('.ashby-job-posting-right-pane, form, [class*="_jobPostingForm_"]') || document.body;
      form.querySelectorAll('input, textarea, select').forEach((ctrl, idx) => {
        if (ctrl.type === 'hidden' || ctrl.type === 'submit' || ctrl.type === 'button' || ctrl.type === 'file' || ctrl.type === 'radio') return;
        if (ctrl.name?.startsWith('g-recaptcha') || ctrl.id?.startsWith('g-recaptcha')) return;
        const cs = window.getComputedStyle(ctrl);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const id = ctrl.id || ctrl.name;
        if (id && usedIds.has(id)) return;
        // Resolve label
        let labelTxt = '';
        if (ctrl.labels?.[0]) labelTxt = ctrl.labels[0].innerText.trim();
        if (!labelTxt && ctrl.id) labelTxt = document.querySelector(`label[for="${ctrl.id}"]`)?.innerText?.trim() || '';
        if (!labelTxt) {
          // Walk up looking for question title or label
          let p = ctrl.parentElement;
          for (let i = 0; i < 6 && p && !labelTxt; i++) {
            const t = p.querySelector(':scope > label, :scope > .ashby-application-form-question-title, :scope > [class*="_heading_"], :scope > div > label');
            if (t) labelTxt = t.innerText.trim();
            p = p.parentElement;
          }
        }
        if (!labelTxt && ctrl.type === 'checkbox') {
          // Checkbox label often comes from sibling text after the input
          let sib = ctrl.parentElement;
          if (sib) labelTxt = sib.innerText.trim();
        }
        labelTxt = labelTxt.replace(/\s+/g, ' ').replace(/\*$/, '').trim();
        if (!labelTxt && !id) return;
        let t = 'text';
        if (ctrl.tagName === 'TEXTAREA') t = 'textarea';
        else if (ctrl.tagName === 'SELECT') t = 'select';
        else if (ctrl.type === 'checkbox') t = 'checkbox';
        else if (ctrl.type === 'email') t = 'email';
        else if (ctrl.type === 'tel') t = 'tel';
        else if (ctrl.type === 'url') t = 'url';
        else if (ctrl.type === 'number') t = 'number';
        out.push({
          id: id || `idx-extra-${out.length}`,
          label: labelTxt || '(unlabelled)',
          type: t,
          required: ctrl.required,
          selectorHint: ctrl.id ? `[id="${ctrl.id}"]` : (ctrl.name ? `[name="${ctrl.name}"]` : null),
          entryIdx: undefined,
        });
        if (id) usedIds.add(id);
      });

      // Fallback pass B: catch radio-groups whose container isn't `.ashby-application-form-field-entry`
      const captured = new Set(out.flatMap(f => f.options?.map(o => o.id) || []));
      const seenNames = new Set(out.filter(f => f.type === 'radio-group').map(f => f.id));
      document.querySelectorAll('input[type="radio"]').forEach(r => {
        if (captured.has(r.id) || seenNames.has(r.name)) return;
        seenNames.add(r.name);
        const sameGroup = [...document.querySelectorAll(`input[type="radio"][name="${r.name}"]`)];
        // Find group title by walking ancestors
        let qLabel = '';
        let p = r.parentElement;
        for (let i = 0; i < 8 && p && !qLabel; i++) {
          const t = p.querySelector('label, .ashby-application-form-question-title, [class*="_heading_"], [class*="_label_"], h3, h4');
          if (t) qLabel = t.innerText.trim().replace(/\s+/g, ' ').replace(/\s*\*$/, '').trim();
          p = p.parentElement;
        }
        const options = sameGroup.map(opt => {
          const lbl = opt.labels?.[0]?.innerText?.trim()
            || document.querySelector(`label[for="${opt.id}"]`)?.innerText?.trim()
            || opt.value || '';
          return { value: opt.value || lbl, label: lbl, id: opt.id };
        });
        if (!qLabel) qLabel = `(radio group ${r.name || ''})`;
        out.push({
          id: r.name || `rg-${out.length}`,
          label: qLabel,
          type: 'radio-group',
          required: r.required,
          options,
          selectorHint: r.name ? `[name="${r.name}"]` : null,
        });
      });

      return out;
    });

    // Deduplicate by label: when Ashby renders typeahead AND text fallback for same Q,
    // prefer the typeahead (it has the proper autocomplete).
    const byLabel = new Map();
    for (const f of fields) {
      const key = f.label.replace(/\*$/, '').trim().toLowerCase();
      const existing = byLabel.get(key);
      if (!existing) {
        byLabel.set(key, f);
      } else {
        // Prefer typeahead/select/radio-group/button-toggle over plain text
        const priority = { typeahead: 5, 'radio-group': 5, 'button-toggle': 5, select: 4, file: 4, textarea: 3, email: 3, tel: 3, url: 3, number: 3, text: 1 };
        if ((priority[f.type] || 2) > (priority[existing.type] || 2)) byLabel.set(key, f);
      }
    }
    return [...byLabel.values()];
  }

  async fillForm(page, schema, answers, files) {
    // Goto already done by inspectForm if same page; reload if not
    if (!page.url().includes(this.applyUrl)) {
      await page.goto(this.applyUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForTimeout(2000);
    }

    for (const field of schema) {
      // Entry-scoped locator (when entryIdx is set); otherwise use selectorHint directly
      const hasEntry = field.entryIdx !== undefined && field.entryIdx !== null;
      const entry = hasEntry
        ? page.locator('.ashby-application-form-field-entry').nth(field.entryIdx)
        : page.locator(field.selectorHint || 'body');

      // File fields should always run (no answer needed — CV/CL paths are passed in)
      if (field.type === 'file') {
        const fp = /cover letter/i.test(field.label) ? files.clPath
          : /resume|cv\b/i.test(field.label) ? files.cvPath
          : /autofill/i.test(field.label) ? files.cvPath
          : files.cvPath;
        if (fp) {
          try {
            const loc = field.selectorHint
              ? page.locator(field.selectorHint).first()
              : entry.locator('input[type="file"]').first();
            await loc.setInputFiles(fp);
            await page.waitForTimeout(1500);
            console.log(`  ✓ ${field.label} [file]: ${fp.split(/[\\/]/).pop()}`);
          } catch (e) {
            console.log(`  ✗ ${field.label} [file]: ${e.message.split('\n')[0]}`);
          }
        }
        continue;
      }

      const value = pickAnswer(field, answers);
      if (value === undefined || value === null) {
        if (field.required) console.log(`  ⚠ ${field.label}: REQUIRED but unanswered`);
        continue;
      }
      try {
        switch (field.type) {
          case 'typeahead': {
            const input = entry.locator('input[role="combobox"], input[placeholder*="Start typing" i]').first();
            const clean = String(value).replace(/\s*\([^)]*\)\s*/g, '').trim();
            const cityPart = clean.split(',')[0].trim();
            const country = (clean.split(',')[1] || '').trim();
            await input.click();
            await input.fill(cityPart);
            await page.waitForTimeout(1500);
            const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Use STRICT selectors for actual option elements (not container divs)
            const optSelector = '[role="option"], [role="listbox"] li, ul[role="listbox"] > *, [class*="_option_"]';
            let opt;
            // Pass 1: "City, Country" exact start
            if (country) {
              opt = page.locator(optSelector)
                .filter({ hasText: new RegExp(`^\\s*${esc(cityPart)},?\\s*${esc(country)}\\b`, 'i') }).first();
              if ((await opt.count()) === 0) {
                // Pass 1b: contains city AND country, somewhere
                opt = page.locator(optSelector)
                  .filter({ hasText: new RegExp(esc(cityPart), 'i') })
                  .filter({ hasText: new RegExp(esc(country), 'i') }).first();
              }
            }
            // Pass 2: city only as fallback (warn — may be wrong city)
            if (!opt || (await opt.count()) === 0) {
              opt = page.locator(optSelector)
                .filter({ hasText: new RegExp(`^\\s*${esc(cityPart)}\\b`, 'i') }).first();
              if (country && (await opt.count()) > 0) {
                console.log(`  ⚠ ${field.label}: fallback to first "${cityPart}" option (couldn't find "${cityPart}, ${country}")`);
              }
            }
            if ((await opt.count()) > 0) await opt.click();
            else { await input.fill(clean); await page.keyboard.press('Enter'); }
            break;
          }
          case 'button-toggle': {
            let want;
            const label = field.label;
            // Step 1: explicit value
            if (/^(yes|true|1)$/i.test(String(value)) || value === true) want = 'Yes';
            else if (/^(no|false|0)$/i.test(String(value)) || value === false) want = 'No';
            // Step 2: POSITIVE phrases that should always be YES (must come BEFORE negative scan)
            else if (/without (the )?need|without sponsorship|no sponsorship needed|legally authoris(e|ed) to work|authorised to work in the country|eligible to work without|currently (have|hold) the legal right|have legal right to work/i.test(label)) want = 'Yes';
            // Step 3: NEGATIVE phrases (require/need sponsor/support)
            else if (/(require|need)\b.*\b(sponsor|sponsorship|visa.*support|work permit|employer support|ongoing.*employer)/i.test(label)
              || /\b(sponsor|sponsorship)\b/i.test(label)) want = 'No';
            // Step 4: bare positive
            else if (/right to work|legal(ly)? authoris|eligible to work/i.test(label)) want = 'Yes';
            else want = (value === true || String(value).toLowerCase().includes('yes')) ? 'Yes' : 'No';
            await entry.getByRole('button', { name: new RegExp(`^${want}$`, 'i') }).first().click();
            break;
          }
          case 'checkbox': {
            const ctrl = page.locator(`[id="${field.id}"]`).first();
            if (value === true || /^yes$/i.test(String(value))) await ctrl.check();
            else await ctrl.uncheck();
            break;
          }
          case 'number': {
            // Extract a numeric value from the answer (handles "£65000", "€70K", "Open. Target range £65K UK / €70K EU…").
            // Heuristic: if label mentions UK or £, use UK expected; if EU/€, use EU; if US/$, use US.
            const labelLower = field.label.toLowerCase();
            const useUK = /£|gbp|uk\b/.test(labelLower) || /london|united kingdom/.test(labelLower);
            const useEU = /€|eur\b|eu\b|europe|berlin|paris|amsterdam|dublin|stockholm/.test(labelLower);
            const useUS = /\$|usd|us\b|united states/.test(labelLower);
            // Pull numeric value from candidate.compensation.expected_*
            const pickFromValue = (v) => {
              if (typeof v === 'number') return String(v);
              const m = String(v).match(/[\d,]{4,}/);
              return m ? m[0].replace(/,/g, '') : '';
            };
            let num = '';
            if (useUK && this.ctx.profile?.compensation?.expected_uk_gbp) num = pickFromValue(this.ctx.profile.compensation.expected_uk_gbp);
            else if (useEU && this.ctx.profile?.compensation?.expected_eu_eur) num = pickFromValue(this.ctx.profile.compensation.expected_eu_eur);
            else if (useUS && this.ctx.profile?.compensation?.expected_us_usd) num = pickFromValue(this.ctx.profile.compensation.expected_us_usd);
            // Last-ditch: parse number from the template string
            if (!num) num = pickFromValue(value);
            if (!num) num = '65000'; // safe default for senior DS
            await page.locator(`[id="${field.id}"]`).first().fill(num);
            break;
          }
          case 'radio-group': {
            // Single-option radio (consent/acknowledgment) — always click it
            if ((field.options || []).length === 1) {
              await page.locator(`[id="${field.options[0].id}"]`).check({ force: true });
              break;
            }
            // Multi-option: match by label/value substring
            const wantStr = String(value).toLowerCase();
            const opt = (field.options || []).find(o =>
              o.label?.toLowerCase().includes(wantStr) || o.value?.toLowerCase().includes(wantStr)
            ) || (field.options || []).find(o =>
              wantStr.includes(o.label?.toLowerCase()) || wantStr.includes(o.value?.toLowerCase())
            );
            if (opt) {
              await page.locator(`[id="${opt.id}"]`).check({ force: true });
            } else {
              console.log(`  ⚠ radio-group "${field.label}": no option matched "${value}". Options: ${field.options.map(o => o.label).join(' | ')}`);
            }
            break;
          }
          case 'select': {
            await page.locator(`[id="${field.id}"]`).first().selectOption({ label: String(value) }).catch(async () => {
              await page.locator(`[id="${field.id}"]`).first().selectOption(String(value));
            });
            break;
          }
          default:
            await page.locator(`[id="${field.id}"]`).first().fill(String(value));
        }
        console.log(`  ✓ ${field.label}: ${truncate(String(value), 50)}`);
      } catch (err) {
        console.log(`  ✗ ${field.label} (${field.type}): ${err.message}`);
      }
    }
    await page.waitForTimeout(800);
  }

  async submit(page) {
    const btn = page.getByRole('button', { name: /submit application|submit/i }).last();
    await btn.click();
    let success = false, confirmationText = '';
    try {
      await page.waitForSelector('text=/successfully submitted|application.* received|thank you|we.ve received/i', { timeout: 30_000 });
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

function prettyCompany(board) {
  return board.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function pickAnswer(field, answers) {
  // Try exact ID match, then label substring (case-insensitive)
  if (answers[field.id] !== undefined) return answers[field.id];
  const labelLower = field.label.toLowerCase();
  for (const [k, v] of Object.entries(answers)) {
    if (labelLower.includes(k.toLowerCase()) || k.toLowerCase().includes(labelLower)) return v;
  }
  return undefined;
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}
