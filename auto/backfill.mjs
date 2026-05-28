/**
 * Backfill jd.md + status.yml for existing runs from their summary.json.
 * Run once: node auto/backfill.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, join } from 'path';

const RUNS_DIR = resolve('tmp/runs');
if (!existsSync(RUNS_DIR)) { console.log('No runs/ directory.'); process.exit(0); }

let touched = 0;

for (const date of readdirSync(RUNS_DIR)) {
  const dateDir = join(RUNS_DIR, date);
  if (!statSync(dateDir).isDirectory()) continue;
  for (const slug of readdirSync(dateDir)) {
    const runDir = join(dateDir, slug);
    if (!statSync(runDir).isDirectory()) continue;
    const summaryPath = join(runDir, 'summary.json');
    if (!existsSync(summaryPath)) continue;
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    const job = summary.job || {};

    // jd.md
    const jdPath = join(runDir, 'jd.md');
    if (!existsSync(jdPath)) {
      const jdMd = [
        `# ${job.company || '?'} — ${job.title || '?'}`,
        ``,
        `- **ATS:** ${summary.ats || job.ats || '?'}`,
        `- **Location:** ${job.location || ''}`,
        `- **Department:** ${job.department || '(unspecified)'}`,
        `- **Workplace:** ${job.workplaceType || (job.isRemote ? 'Remote' : 'On-site')}`,
        `- **Job URL:** ${job.jobUrl || ''}`,
        `- **Apply URL:** ${job.applyUrl || ''}`,
        ``,
        `## Description`,
        ``,
        job.jdText || '(no JD text in summary)',
      ].join('\n');
      writeFileSync(jdPath, jdMd);
      touched++;
      console.log(`  + jd.md → ${date}/${slug}`);
    }

    // status.yml
    const statusPath = join(runDir, 'status.yml');
    if (!existsSync(statusPath)) {
      const submitted = summary.submission?.success === true;
      const stage = submitted ? 'submitted' : 'dry-run';
      writeFileSync(statusPath, [
        `# Update this file as the application progresses.`,
        `# Valid stages: submitted, viewed, screen, interview-1, interview-2, interview-final, offer, rejected, withdrawn, ghosted`,
        `stage: ${stage}`,
        `submitted_at: ${summary.timestamp || new Date().toISOString()}`,
        `last_update: ${new Date().toISOString()}`,
        `notes: ""`,
      ].join('\n'));
      touched++;
      console.log(`  + status.yml → ${date}/${slug}`);
    }
  }
}

console.log(`\nBackfill done. ${touched} files written.`);
