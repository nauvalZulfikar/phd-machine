/**
 * ATS adapter base interface.
 * Every adapter implements: fetchJobMeta, inspectForm, fillForm, submit.
 *
 * Field schema returned by inspectForm():
 *   { id, label, type, required, options?, selectorHint }
 *
 *   type ∈ 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select'
 *        | 'checkbox' | 'radio' | 'button-toggle' | 'typeahead' | 'file'
 *
 * Files passed to fillForm():
 *   { cvPath, clPath }
 *
 * Answers map: { fieldId | label-substring → value }
 *   - string for text/textarea/url/email/tel/select
 *   - boolean for checkbox/button-toggle (true=yes, false=no)
 *   - { label: '...' } to pick a specific option from typeahead/select
 */
export class BaseAdapter {
  constructor(url, ctx = {}) {
    this.url = url;
    this.ctx = ctx;
    this.type = 'base';
  }

  async fetchJobMeta() {
    throw new Error('fetchJobMeta not implemented');
  }

  async inspectForm(page) {
    throw new Error('inspectForm not implemented');
  }

  async fillForm(page, schema, answers, files) {
    throw new Error('fillForm not implemented');
  }

  async submit(page) {
    throw new Error('submit not implemented');
  }
}

/** Common Playwright helpers shared across adapters. */
export const helpers = {
  async setTextById(page, id, value) {
    const sel = id.match(/^\d/) ? `#\\3${id[0]} ${id.slice(1)}` : `#${CSS.escape ? CSS.escape(id) : id}`;
    // Playwright's locator accepts CSS escaping for IDs starting with digits via attribute selector
    const loc = page.locator(`[id="${id}"]`).first();
    await loc.fill(String(value ?? ''));
  },
  async setFileById(page, id, filePath) {
    await page.locator(`[id="${id}"]`).first().setInputFiles(filePath);
  },
  async clickButtonInGroupByLabel(page, groupLabelSubstr, optionText) {
    // Find a container that includes the label text AND a button with optionText
    const container = page.locator('div,fieldset,section')
      .filter({ hasText: groupLabelSubstr })
      .filter({ has: page.getByRole('button', { name: new RegExp(`^${optionText}$`, 'i') }) })
      .first();
    await container.getByRole('button', { name: new RegExp(`^${optionText}$`, 'i') }).first().click();
  },
  async selectByLabel(page, labelText, optionText) {
    const select = page.locator(`label:has-text("${labelText}")`).first()
      .locator('xpath=following::select[1]');
    await select.selectOption({ label: optionText });
  },
  async typeAheadSelect(page, inputLocator, query, optionMatcher) {
    await inputLocator.click();
    await inputLocator.fill(query);
    await page.waitForTimeout(900);
    const opt = page.locator('li,div[role="option"],button,div')
      .filter({ hasText: optionMatcher || new RegExp(query, 'i') })
      .first();
    if ((await opt.count()) > 0) {
      await opt.click();
      return true;
    }
    return false;
  },
  /** Take a fullPage screenshot and return its absolute path. */
  async screenshot(page, outPath) {
    await page.screenshot({ path: outPath, fullPage: true });
    return outPath;
  },
};
