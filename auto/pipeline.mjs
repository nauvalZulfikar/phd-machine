/**
 * End-to-end orchestrator.
 *
 *   const result = await runPipeline(jobUrl, { dryRun: true, profile, browser });
 *
 * Steps:
 *   1. Detect ATS, fetch job meta
 *   2. (Skipped here) AI score
 *   3. Tailor CV directives → render HTML → PDF
 *   4. Tailor CL → render HTML → PDF
 *   5. Open browser, inspect form
 *   6. Resolve answers from profile + AI
 *   7. Fill form, screenshot
 *   8. If !dryRun: submit, capture confirmation
 */
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve, basename } from 'path';
import { spawnSync } from 'child_process';
import { chromium } from 'playwright';

import { buildAdapter } from './ats/detect.mjs';
import { tailorCv, tailorCl, renderCvHtml, renderClHtml } from './cv/render.mjs';
import { resolveAnswers } from './qa/match.mjs';
import { aiMeta } from './ai/client.mjs';

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function generatePdf(htmlPath, pdfPath) {
  const r = spawnSync('node', ['generate-pdf.mjs', htmlPath, pdfPath], { encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`PDF gen failed: ${r.stderr || r.stdout}`);
  return pdfPath;
}

export async function runPipeline(jobUrl, opts) {
  const { profile, dryRun = true } = opts;
  console.log(`\n━━━ Pipeline ━━━`);
  console.log(`URL:        ${jobUrl}`);
  console.log(`LLM provider: ${aiMeta.provider}`);
  console.log(`Dry run:    ${dryRun}\n`);

  // 1. Adapter + job meta (pass profile so adapter can use comp/etc. for number fields)
  const adapter = buildAdapter(jobUrl, { profile });
  console.log(`▶ ATS: ${adapter.type}`);
  const jobMeta = await adapter.fetchJobMeta();
  console.log(`▶ Job: ${jobMeta.company} — ${jobMeta.title} (${jobMeta.location})`);

  // 2. Output dir
  const stamp = new Date().toISOString().slice(0, 10);
  const runDir = resolve(`tmp/runs/${stamp}/${slug(jobMeta.company)}-${slug(jobMeta.title)}`);
  mkdirSync(runDir, { recursive: true });
  console.log(`▶ Run dir: ${runDir}`);

  // 2b. Save JD as standalone markdown for easy reading + dashboard rendering
  const jdMd = [
    `# ${jobMeta.company} — ${jobMeta.title}`,
    ``,
    `- **ATS:** ${jobMeta.ats}`,
    `- **Location:** ${jobMeta.location}`,
    `- **Department:** ${jobMeta.department || '(unspecified)'}`,
    `- **Workplace:** ${jobMeta.workplaceType || (jobMeta.isRemote ? 'Remote' : 'On-site')}`,
    `- **Job URL:** ${jobMeta.jobUrl}`,
    `- **Apply URL:** ${jobMeta.applyUrl}`,
    ``,
    `## Description`,
    ``,
    jobMeta.jdText || '(no JD text available)',
  ].join('\n');
  writeFileSync(resolve(runDir, 'jd.md'), jdMd);

  // 2c. Initialize status.yml if not present (user updates as the application progresses)
  const statusPath = resolve(runDir, 'status.yml');
  if (!existsSync(statusPath)) {
    writeFileSync(statusPath, [
      `# Update this file as the application progresses.`,
      `# Valid stages: submitted, viewed, screen, interview-1, interview-2, interview-final, offer, rejected, withdrawn, ghosted`,
      `stage: ${dryRun ? 'dry-run' : 'submitted'}`,
      `submitted_at: ${new Date().toISOString()}`,
      `last_update: ${new Date().toISOString()}`,
      `notes: ""`,
    ].join('\n'));
  }

  // 3. CV tailor + render + PDF
  console.log(`▶ Tailoring CV...`);
  const cvDirectives = await tailorCv(profile, jobMeta);
  const cvHtmlPath = resolve(runDir, 'cv.html');
  const cvPdfPath = resolve(runDir, 'cv.pdf');
  const cvHtml = renderCvHtml(profile, cvDirectives);
  writeFileSync(cvHtmlPath, cvHtml);
  generatePdf(cvHtmlPath, cvPdfPath);
  console.log(`  ✓ ${basename(cvPdfPath)}`);

  // 4. Cover letter
  console.log(`▶ Tailoring cover letter...`);
  const clBody = await tailorCl(profile, jobMeta);
  const clHtmlPath = resolve(runDir, 'cl.html');
  const clPdfPath = resolve(runDir, 'cl.pdf');
  const clHtml = renderClHtml(profile, jobMeta, clBody);
  writeFileSync(clHtmlPath, clHtml);
  generatePdf(clHtmlPath, clPdfPath);
  console.log(`  ✓ ${basename(clPdfPath)}`);

  // 5. Browser open + inspect
  const browser = await chromium.launch({ headless: !opts.headed });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  console.log(`▶ Inspecting form...`);
  const schema = await adapter.inspectForm(page);
  writeFileSync(resolve(runDir, 'form-schema.json'), JSON.stringify(schema, null, 2));
  console.log(`  ${schema.length} fields detected`);

  // 6. Resolve answers
  console.log(`▶ Resolving answers...`);
  const answers = await resolveAnswers(schema, profile, jobMeta);
  writeFileSync(resolve(runDir, 'answers.json'), JSON.stringify(answers, null, 2));
  console.log(`  ${Object.keys(answers).length}/${schema.length} fields answered`);

  const missing = schema.filter(f => f.required && answers[f.id] === undefined && f.type !== 'file');
  if (missing.length) {
    console.log(`  ⚠ Missing REQUIRED: ${missing.map(f => f.label).join(' | ')}`);
    // Don't waste time filling + submitting a form that will fail validation.
    // Soft-skip: exit 5 so cron treats as skip (not consec-fail / shutdown).
    if (!dryRun) {
      console.log(`SKIPPED: ${missing.length} required field(s) unanswered — add qa_hints in profile.yml to handle.`);
      await browser.close();
      process.exit(5);
    }
  }

  // 7. Fill form
  console.log(`▶ Filling form...`);
  await adapter.fillForm(page, schema, answers, { cvPath: cvPdfPath, clPath: clPdfPath });
  const screenshotPath = resolve(runDir, 'form-filled.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  ✓ Screenshot: ${basename(screenshotPath)}`);

  // 8. Submit
  let submission = null;
  if (!dryRun) {
    console.log(`\n▶▶▶ SUBMITTING ▶▶▶`);
    submission = await adapter.submit(page);
    const confirmPath = resolve(runDir, 'confirmation.png');
    await page.screenshot({ path: confirmPath, fullPage: true });
    writeFileSync(resolve(runDir, 'confirmation.txt'), `URL: ${submission.finalUrl}\nSuccess: ${submission.success}\n\n${submission.confirmationText}`);
    console.log(submission.success ? `✅ Submitted: ${jobMeta.company} — ${jobMeta.title}` : `⚠ Submitted but no success indicator — review ${basename(confirmPath)}`);
  }

  await browser.close();

  // 9. Write run summary
  const summary = {
    job: jobMeta,
    ats: adapter.type,
    runDir,
    files: {
      cv: cvPdfPath, cl: clPdfPath, schema: 'form-schema.json',
      answers: 'answers.json', formScreenshot: screenshotPath,
    },
    answers,
    missingRequired: missing.map(m => m.label),
    submission,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(resolve(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
