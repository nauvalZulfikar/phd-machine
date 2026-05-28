#!/usr/bin/env node
import 'dotenv/config';
/**
 * Per-opportunity tailoring — generates customised application materials.
 *
 *   node auto/tailor.mjs --profile profiles/nauval_phd.yaml --min-score 70 [--limit 3]
 *                        [--input data/academic/scored.jsonl]
 *                        [--rs path/to/base/research_statement.md]
 *                        [--ps path/to/base/personal_statement.md]
 *
 * For each opportunity ≥ min-score:
 *   drafts/<opp-id>/
 *     ├── cover_email.md         (subject + body, cold outreach)
 *     ├── rs_why_this_opp.md     (RS "Why this opportunity" insert section)
 *     ├── ps_opening_hook.md     (PS opening 1-2 sentences rewrite)
 *     └── apply_summary.md       (deadline, portal, action items, URLs)
 *
 * Strategy: keep base RS/PS unchanged. Generate only the customised
 * SECTIONS that change per application. User pastes them in when applying.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { load as yamlLoad } from 'js-yaml';
import { complete, aiMeta, isBaseline } from './ai/client.mjs';

const DEFAULT_RS = 'D:/Downloads/coding project/phd_aston_prep/application/research_statement.md';
const DEFAULT_PS = 'D:/Downloads/coding project/phd_aston_prep/application/personal_statement.md';
const DRAFTS_DIR = 'data/academic/drafts';

function parseArgs(argv) {
  const args = {
    profile: 'profiles/nauval_phd.yaml',
    input: 'data/academic/scored.jsonl',
    minScore: 70,
    limit: 0,
    rs: DEFAULT_RS,
    ps: DEFAULT_PS,
    force: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    if (a === '--profile') { args.profile = n; i++; }
    else if (a === '--input') { args.input = n; i++; }
    else if (a === '--min-score') { args.minScore = parseInt(n, 10); i++; }
    else if (a === '--limit') { args.limit = parseInt(n, 10); i++; }
    else if (a === '--rs') { args.rs = n; i++; }
    else if (a === '--ps') { args.ps = n; i++; }
    else if (a === '--force') { args.force = true; }
  }
  return args;
}

function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

const SYSTEM_PROMPT = `You are an expert academic application writer. You produce concise, specific, and grounded tailoring content for PhD / postdoc / research applications.

Style rules:
- British English. Harvard citation style if you cite.
- No em-dashes (—). Use ": " or ", " or parentheses instead.
- Specific, not generic. Reference the OPPORTUNITY's keywords, supervisor (if named), methods, and gaps explicitly.
- Show fit through concrete artefacts (named repos, named methods, named MSc dissertation supervisor).
- Length discipline: respect word/character limits given in each task.

ANTI-HALLUCINATION RULES (critical — violation = unusable output):
- NEVER invent supervisor names, emails, addresses, deadlines, salaries, or contact info that are NOT explicitly present in the OPPORTUNITY block.
- If a field in OPPORTUNITY is "(not stated)", your output MUST also say "(not stated)" or "TBD — confirm from posting URL" or "the listed supervisor on the posting". Do not substitute plausible-sounding placeholders from training data.
- next_action: if no supervisor name is provided, write something like "Email the listed supervisor on the posting at the email shown there" — NEVER fabricate a name like "Dr X Smith".
- cover_email body: if no supervisor name, address as "Dear Hiring Committee" or "Dear Search Committee". Never make one up.
- If you are uncertain about ANY fact (name, email, address, deadline), write the literal phrase "(verify from posting)" inline. The user will fill in.`;

function buildPrompt(profile, opp, baseRsExcerpt, basePsExcerpt) {
  return `## RESEARCHER PROFILE

\`\`\`yaml
${JSON.stringify(profile, null, 2)}
\`\`\`

## BASE RESEARCH STATEMENT (current generic version, for context)

\`\`\`markdown
${baseRsExcerpt}
\`\`\`

## BASE PERSONAL STATEMENT OPENING (current generic version, for context)

\`\`\`markdown
${basePsExcerpt}
\`\`\`

## TARGET OPPORTUNITY

- **Title**: ${opp.title}
- **Type**: ${opp.type}
- **Organisation**: ${opp.organization || '(not stated)'}
- **Location**: ${opp.location || opp.country || '(not stated)'}
- **Supervisor named**: ${opp.supervisor || '(not stated)'}
- **Deadline**: ${opp.deadline || '(not stated)'}
- **Funding**: ${opp.fundingType} ${opp.fundingDetails ? '(' + opp.fundingDetails + ')' : ''}
- **URL**: ${opp.url}

**Posting description (verbatim, may be partial)**:
${opp.description || '(no description scraped)'}

## YOUR TASKS

Return JSON with exactly these four keys:

{
  "cover_email": {
    "subject": "<email subject line, ≤80 chars, specific to project+supervisor>",
    "body": "<full email body, ≤300 words, in plain text with line breaks. Open with WHY THIS PROJECT (not generic). Cite ONE specific element of the project. Mention one specific GitHub repo from profile that demonstrates fit. Close with concrete ask (15-min call? CV review?). Sign as 'Nauval'.>"
  },

  "rs_why_this_opp": {
    "section_title": "Why ${opp.organization || 'this opportunity'}",
    "paragraph": "<2-4 paragraphs, ≤350 words total. Map researcher's prototypes/methods 1:1 to the opportunity's stated topic. Reference the supervisor by name if known. Cite the host organisation's positioning. Treat this as a section to PASTE INTO the Research Statement before submission.>"
  },

  "ps_opening_hook": {
    "replacement_opening": "<2-3 sentences, ≤100 words, that replace the current generic Bandung-traffic opening for this specific application. The hook MUST connect researcher's lived experience or prior work to THIS OPPORTUNITY's specific topic (not generic PhD application).>"
  },

  "apply_summary": {
    "next_action": "<one sentence telling the user what to do next. If supervisor is known, use their actual name; otherwise write 'Email the listed supervisor (name on posting)' — DO NOT INVENT A NAME. Include the deadline only if it appears in OPPORTUNITY (else write '(verify deadline from posting)'). Example shape: 'Email <real-supervisor-name-or-placeholder> at the address on the posting, attach CV + tailored RS, before <deadline-or-placeholder>'>",
    "portal_type": "<'direct_email' or 'university_portal' or 'jobs_ac_uk_apply' or 'unknown'>",
    "key_documents_needed": ["<doc>", "<doc>"],
    "estimated_effort_hours": <integer>,
    "risks_or_questions": ["<bullet>", "<bullet>"]
  }
}`;
}

async function tailorOne(profile, opp, baseRs, basePs) {
  // Excerpt only first 1500 chars of base files to keep prompt size manageable
  const baseRsExcerpt = baseRs.slice(0, 1500);
  const basePsExcerpt = basePs.slice(0, 1500);
  const prompt = buildPrompt(profile, opp, baseRsExcerpt, basePsExcerpt);
  const result = await complete({
    system: SYSTEM_PROMPT,
    prompt,
    json: true,
    maxTokens: 4096,
  });
  if (result?.__baseline) {
    throw new Error('LLM provider not configured. Set OPENAI_API_KEY in .env');
  }
  if (result?.__parseError) {
    throw new Error('LLM returned unparsable JSON: ' + result.raw.slice(0, 200));
  }
  return result;
}

function writeDraftFiles(opp, draft) {
  const id = `${opp.source}-${slug(opp.organization || 'unknown')}-${slug(opp.title).slice(0, 30)}`;
  const dir = resolve(DRAFTS_DIR, id);
  mkdirSync(dir, { recursive: true });

  // 1. Cover email
  const emailMd = [
    `# Cover Email — ${opp.title}`,
    ``,
    `**To**: ${opp.supervisor || '(supervisor name from job listing)'}`,
    `**Subject**: ${draft.cover_email.subject}`,
    ``,
    `---`,
    ``,
    draft.cover_email.body,
    ``,
    `---`,
    ``,
    `*Source: ${opp.url}*`,
  ].join('\n');
  writeFileSync(resolve(dir, 'cover_email.md'), emailMd, 'utf-8');

  // 2. RS section
  const rsMd = [
    `# RS Insert — ${draft.rs_why_this_opp.section_title}`,
    ``,
    `*Paste this section into your Research Statement before the "Workplan" or "Fit" section.*`,
    ``,
    `---`,
    ``,
    `## ${draft.rs_why_this_opp.section_title}`,
    ``,
    draft.rs_why_this_opp.paragraph,
  ].join('\n');
  writeFileSync(resolve(dir, 'rs_why_this_opp.md'), rsMd, 'utf-8');

  // 3. PS hook
  const psMd = [
    `# PS Opening Hook — ${opp.title}`,
    ``,
    `*Replace the first 1-2 paragraphs of personal_statement.md with this.*`,
    ``,
    `---`,
    ``,
    draft.ps_opening_hook.replacement_opening,
  ].join('\n');
  writeFileSync(resolve(dir, 'ps_opening_hook.md'), psMd, 'utf-8');

  // 4. Apply summary
  const sm = draft.apply_summary;
  const summaryMd = [
    `# Apply Summary — ${opp.title}`,
    ``,
    `**Score**: ${opp.score?.score || '?'}/100 (${opp.score?.verdict || '?'})`,
    `**Organisation**: ${opp.organization || '?'}`,
    `**Type**: ${opp.type}`,
    `**Deadline**: ${opp.deadline || '(not stated)'}`,
    `**Funding**: ${opp.fundingType} ${opp.fundingDetails || ''}`,
    `**Supervisor**: ${opp.supervisor || '(not stated)'}`,
    `**Portal type**: ${sm.portal_type}`,
    ``,
    `## Next action`,
    ``,
    `${sm.next_action}`,
    ``,
    `## Documents needed`,
    ``,
    sm.key_documents_needed.map(d => `- ${d}`).join('\n'),
    ``,
    `## Estimated effort`,
    ``,
    `${sm.estimated_effort_hours} hour(s)`,
    ``,
    `## Risks / open questions`,
    ``,
    sm.risks_or_questions.map(r => `- ${r}`).join('\n'),
    ``,
    `---`,
    ``,
    `**URL**: ${opp.url}`,
    ``,
    `**Generated**: ${new Date().toISOString()}`,
  ].join('\n');
  writeFileSync(resolve(dir, 'apply_summary.md'), summaryMd, 'utf-8');

  return dir;
}

async function main() {
  const args = parseArgs(process.argv);

  console.log(`━━━ Academic Tailoring ━━━`);
  console.log(`Profile:    ${args.profile}`);
  console.log(`Input:      ${args.input}`);
  console.log(`Min score:  ${args.minScore}`);
  console.log(`LLM:        ${aiMeta.provider}`);
  console.log(`Base RS:    ${args.rs}`);
  console.log(`Base PS:    ${args.ps}`);
  console.log(``);

  if (isBaseline()) {
    console.error(`! No LLM configured. Set OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY in .env`);
    process.exit(1);
  }

  const profile = yamlLoad(readFileSync(resolve(args.profile), 'utf-8'));
  const baseRs = existsSync(args.rs) ? readFileSync(args.rs, 'utf-8') : '(base RS not found)';
  const basePs = existsSync(args.ps) ? readFileSync(args.ps, 'utf-8') : '(base PS not found)';

  const scored = loadJsonl(resolve(args.input));
  const candidates = scored
    .filter(o => (o.score?.score || 0) >= args.minScore)
    .sort((a, b) => b.score.score - a.score.score);
  console.log(`Eligible (score ≥ ${args.minScore}): ${candidates.length}`);

  const toTailor = args.limit ? candidates.slice(0, args.limit) : candidates;
  console.log(`Tailoring: ${toTailor.length}`);
  console.log(``);

  mkdirSync(resolve(DRAFTS_DIR), { recursive: true });

  for (let i = 0; i < toTailor.length; i++) {
    const opp = toTailor[i];
    const dirSlug = `${opp.source}-${slug(opp.organization || 'unknown')}-${slug(opp.title).slice(0, 30)}`;
    const existingDir = resolve(DRAFTS_DIR, dirSlug);
    if (!args.force && existsSync(existingDir) && existsSync(resolve(existingDir, 'cover_email.md'))) {
      console.log(`[${i + 1}/${toTailor.length}] ${opp.title.slice(0, 60)} → SKIP (already drafted)`);
      continue;
    }
    console.log(`[${i + 1}/${toTailor.length}] ${opp.title.slice(0, 60)}`);
    try {
      const draft = await tailorOne(profile, opp, baseRs, basePs);
      const dir = writeDraftFiles(opp, draft);
      console.log(`  ✓ ${dir}`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
    }
  }

  console.log(``);
  console.log(`Done. Drafts in: ${resolve(DRAFTS_DIR)}`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
