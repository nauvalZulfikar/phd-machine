#!/usr/bin/env node
import 'dotenv/config';
/**
 * LLM-powered academic opportunity scorer.
 *
 *   node auto/score.mjs --profile profiles/nauval_phd.yaml [--top 10]
 *                       [--input data/academic/opportunities.jsonl]
 *                       [--output data/academic/scored.jsonl]
 *                       [--rescore]
 *
 * For each opportunity in input, calls LLM with profile + opportunity context,
 * receives:
 *   { score: 0-100, verdict: 'strong-fit'|'good-fit'|'mid-fit'|'weak-fit'|'reject',
 *     reasoning: '...', strengths: [...], gaps: [...], deal_breakers: [...] }
 *
 * Skips already-scored opportunities (by sourceId) unless --rescore.
 * Writes ranked digest to data/academic/digests/scored-YYYY-MM-DD.md.
 */

import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { load as yamlLoad } from 'js-yaml';

import { complete, aiMeta, isBaseline } from './ai/client.mjs';

function parseArgs(argv) {
  const args = {
    profile: 'profiles/nauval_phd.yaml',
    input: 'data/academic/opportunities.jsonl',
    output: 'data/academic/scored.jsonl',
    top: 10,
    rescore: false,
    limit: 0,  // 0 = no limit
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i], n = argv[i + 1];
    if (a === '--profile') { args.profile = n; i++; }
    else if (a === '--input') { args.input = n; i++; }
    else if (a === '--output') { args.output = n; i++; }
    else if (a === '--top') { args.top = parseInt(n, 10); i++; }
    else if (a === '--rescore') { args.rescore = true; }
    else if (a === '--limit') { args.limit = parseInt(n, 10); i++; }
  }
  return args;
}

function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

const SYSTEM_PROMPT = `You are a careful academic opportunity matcher. Given a researcher's profile and a PhD/postdoc/research opportunity, you score the fit on a 0-100 scale and explain your reasoning.

Scoring rubric:
- 90-100: Strong fit. Methods + topic + field all align tightly. Researcher should apply.
- 75-89: Good fit. Most criteria met, minor gaps. Worth applying.
- 60-74: Mid fit. Adjacent field or partial method overlap. Consider only if low volume.
- 40-59: Weak fit. Some surface keywords but core mismatch.
- 0-39: Reject. Wrong field, missing required skills, or dealbreaker hit.

Hard constraints (auto-reject):
- If opportunity is "self-funded" and profile requires funded → score ≤ 30 and verdict "reject"
- If opportunity requires citizenship the profile doesn't have → score ≤ 30 and verdict "reject"
- If opportunity is in a field listed in profile.dealbreakers → score ≤ 25 and verdict "reject"`;

function buildPrompt(profile, opp) {
  return `## RESEARCHER PROFILE

\`\`\`yaml
${JSON.stringify(profile, null, 2)}
\`\`\`

## OPPORTUNITY

- **Title**: ${opp.title}
- **Source**: ${opp.source}
- **Type**: ${opp.type}
- **Organisation**: ${opp.organization || 'unknown'}
- **Location**: ${opp.location || 'unknown'}
- **Country**: ${opp.country || 'unknown'}
- **Deadline**: ${opp.deadline || 'not stated'}
- **Funding**: ${opp.fundingType} ${opp.fundingDetails ? '(' + opp.fundingDetails + ')' : ''}
- **Supervisor**: ${opp.supervisor || 'not stated'}
- **URL**: ${opp.url}

**Description / posted text**:
${opp.description || '(no description scraped)'}

## YOUR TASK

Return JSON:
{
  "score": <0-100>,
  "verdict": "strong-fit|good-fit|mid-fit|weak-fit|reject",
  "reasoning": "<one paragraph, 2-4 sentences, why this score>",
  "strengths": ["<bullet>", "<bullet>"],
  "gaps": ["<bullet>", "<bullet>"],
  "deal_breakers": ["<bullet>"]  // empty if none
}`;
}

function verdictEmoji(v) {
  return { 'strong-fit': '🟢', 'good-fit': '🟡', 'mid-fit': '🟠', 'weak-fit': '🔴', 'reject': '⛔' }[v] || '⚪';
}

// Strip newlines and optionally trim to max length
function stripNewlines(s, maxLen = 0) {
  const clean = (s || '').replace(/[\r\n]/g, ' ');
  return maxLen ? clean.slice(0, maxLen) : clean;
}

async function scoreOne(profile, opp) {
  const result = await complete({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt(profile, opp),
    json: true,
    maxTokens: 1500,
  });
  if (result?.__baseline) {
    // No LLM available - baseline heuristic scorer
    return baselineScore(profile, opp);
  }
  if (result?.__parseError) {
    return { score: 0, verdict: 'reject', reasoning: 'LLM parse error', strengths: [], gaps: [], deal_breakers: [], _error: true };
  }
  return result;
}

function baselineScore(profile, opp) {
  // Keyword-based scoring fallback. Match on individual TOKENS (not phrases).
  const text = `${opp.title} ${opp.description}`.toLowerCase();

  // Token extraction: split on spaces, slashes, commas, parens, dashes
  function tokens(s) {
    return s.toLowerCase().split(/[\s\/,()\-]+/).filter(t => t.length >= 4);
  }

  // Critical keywords (each one in text scores big)
  const criticalTokens = new Set([
    'digital twin', 'crowd-shipping', 'crowdshipping', 'crowd shipping',
    'vehicle routing', 'vrp', 'vrpod', 'occasional driver',
    'agent-based', 'agent based', 'simulation', 'abm',
    'last-mile', 'last mile', 'urban logistic',
    'integrated passenger', 'passenger-freight', 'passenger freight',
    'operations research',
  ]);

  const supportiveTokens = new Set([
    'logistic', 'transport', 'mobility', 'routing', 'optimisation', 'optimization',
    'milp', 'mixed integer', 'discrete-choice', 'discrete choice', 'choice model',
    'behavioural', 'behavioral', 'gig', 'sharing economy',
    'llm', 'large language', 'rag', 'retrieval-augmented',
    'supply chain', 'sustainability',
  ]);

  let critHits = 0;
  for (const k of criticalTokens) if (text.includes(k)) critHits++;
  let suppHits = 0;
  for (const k of supportiveTokens) if (text.includes(k)) suppHits++;

  // Dealbreakers
  const dealbreakers = (profile.dealbreakers || []).map(d => d.toLowerCase());
  let dbHit = false;
  for (const d of dealbreakers) {
    const dn = d.replace(/_/g, ' ');
    if (text.includes(dn)) { dbHit = true; break; }
  }

  // Base scoring
  let score = 25 + critHits * 18 + suppHits * 6;

  // Funded vs self-funded
  if (opp.fundingType === 'self-funded' && profile.constraints?.must_be_funded) {
    score = Math.min(score, 25);
  }
  // Postdoc/research bonus if salary mentioned
  if (/£|€|\$|stipend/.test(opp.fundingDetails || '')) {
    score += 5;
  }
  // Region bonus
  const country = (opp.country || opp.location || '').toLowerCase();
  const priority1 = (profile.target_regions?.priority_1 || []).map(c => c.toLowerCase());
  const priority2 = (profile.target_regions?.priority_2 || []).map(c => c.toLowerCase());
  const priority3 = (profile.target_regions?.priority_3 || []).map(c => c.toLowerCase());
  if (priority1.some(c => country.includes(c) || c.includes(country))) score += 8;
  else if (priority2.some(c => country.includes(c) || c.includes(country))) score += 4;
  else if (priority3.some(c => country.includes(c) || c.includes(country))) score += 2;

  // Type alignment
  const targetTypes = profile.target_types || [];
  if (targetTypes.includes(opp.type)) score += 3;

  if (dbHit) score = Math.min(score, 15);

  score = Math.max(0, Math.min(100, score));
  const verdict = score >= 85 ? 'strong-fit' : score >= 70 ? 'good-fit'
    : score >= 55 ? 'mid-fit' : score >= 40 ? 'weak-fit' : 'reject';

  return {
    score,
    verdict,
    reasoning: `Baseline scorer: ${critHits} critical + ${suppHits} supportive keyword hits${dbHit ? ' (DEALBREAKER hit)' : ''}.`,
    strengths: [],
    gaps: [],
    deal_breakers: dbHit ? ['dealbreaker keyword detected in posting'] : [],
    _baseline: true,
  };
}

function writeScoredDigest(scoredAll, top) {
  const today = new Date().toISOString().slice(0, 10);
  const path = resolve(`data/academic/digests/scored-${today}.md`);
  const sorted = [...scoredAll].sort((a, b) => b.score.score - a.score.score);
  const lines = [
    `# Scored Academic Opportunities — ${today}`,
    ``,
    `**Total scored:** ${scoredAll.length} · **Top:** ${top}`,
    `**LLM provider:** ${aiMeta.provider}`,
    ``,
    `| # | Score | Verdict | Title | Org | Type | Deadline |`,
    `|---|---|---|---|---|---|---|`,
  ];
  for (let i = 0; i < Math.min(top * 3, sorted.length); i++) {
    const o = sorted[i];
    const s = o.score;
    lines.push(`| ${i + 1} | **${s.score}** | ${verdictEmoji(s.verdict)} ${s.verdict} | [${o.title.slice(0, 60)}](${o.url}) | ${o.organization || '?'} | ${o.type} | ${o.deadline || '?'} |`);
  }

  lines.push('');
  lines.push(`## Top ${top} Detailed`);
  lines.push('');
  for (let i = 0; i < Math.min(top, sorted.length); i++) {
    const o = sorted[i];
    const s = o.score;
    lines.push(`### ${i + 1}. ${verdictEmoji(s.verdict)} ${s.score}/100 — ${o.title}`);
    lines.push(`**${o.organization || '?'}** · ${o.country || o.location || '?'} · ${o.type} · ${o.fundingType}`);
    if (o.deadline) lines.push(`📅 Deadline: ${o.deadline}`);
    if (o.supervisor) lines.push(`👤 Supervisor: ${o.supervisor}`);
    lines.push(``);
    lines.push(`**${s.reasoning}**`);
    if (s.strengths?.length) {
      lines.push(``);
      lines.push(`✅ Strengths:`);
      for (const x of s.strengths) lines.push(`- ${x}`);
    }
    if (s.gaps?.length) {
      lines.push(``);
      lines.push(`⚠️ Gaps:`);
      for (const x of s.gaps) lines.push(`- ${x}`);
    }
    if (s.deal_breakers?.length) {
      lines.push(``);
      lines.push(`⛔ Deal-breakers:`);
      for (const x of s.deal_breakers) lines.push(`- ${x}`);
    }
    lines.push(``);
    lines.push(`🔗 ${o.url}`);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }
  writeFileSync(path, lines.join('\n'), 'utf-8');
  return path;
}

async function main() {
  const args = parseArgs(process.argv);

  console.log(`━━━ Academic Scorer ━━━`);
  console.log(`Profile:  ${args.profile}`);
  console.log(`Input:    ${args.input}`);
  console.log(`Output:   ${args.output}`);
  console.log(`Top:      ${args.top}`);
  console.log(`LLM:      ${aiMeta.provider}${isBaseline() ? ' (baseline mode — set ANTHROPIC_API_KEY or GEMINI_API_KEY)' : ''}`);
  console.log(``);

  const profileYaml = readFileSync(resolve(args.profile), 'utf-8');
  const profile = yamlLoad(profileYaml);

  const opportunities = loadJsonl(resolve(args.input));
  console.log(`Loaded ${opportunities.length} opportunities`);

  // Load existing scores
  const existing = loadJsonl(resolve(args.output));
  const scoredSet = new Set(existing.map(e => e.sourceId));
  console.log(`Already scored: ${scoredSet.size}`);

  const toScore = args.rescore
    ? opportunities
    : opportunities.filter(o => !scoredSet.has(o.sourceId));
  const trimmed = args.limit ? toScore.slice(0, args.limit) : toScore;
  console.log(`To score now:   ${trimmed.length}`);
  console.log(``);

  mkdirSync(resolve('data/academic/digests'), { recursive: true });

  let scored = [];
  for (let i = 0; i < trimmed.length; i++) {
    const opp = trimmed[i];
    const safeProgressTitle = stripNewlines(opp.title, 60).padEnd(62);
    process.stdout.write(`[${i + 1}/${trimmed.length}] ${safeProgressTitle} `);
    try {
      const score = await scoreOne(profile, opp);
      const enriched = { sourceId: opp.sourceId, ...opp, score, scoredAt: new Date().toISOString() };
      scored.push(enriched);
      appendFileSync(resolve(args.output), JSON.stringify(enriched) + '\n', 'utf-8');
      console.log(`→ ${verdictEmoji(score.verdict)} ${score.score}/100 ${score.verdict}`);
    } catch (e) {
      console.log(`✗ ${e.message}`);
    }
  }

  // Merge with existing for digest
  const allScored = args.rescore ? scored : [...existing, ...scored];
  const digestPath = writeScoredDigest(allScored, args.top);
  console.log(``);
  console.log(`Wrote scored digest: ${digestPath}`);

  // Top-N preview
  const sorted = [...allScored].sort((a, b) => b.score.score - a.score.score);
  console.log(``);
  console.log(`━━━ Top ${args.top} ━━━`);
  for (let i = 0; i < Math.min(args.top, sorted.length); i++) {
    const o = sorted[i], s = o.score;
    const safeTitle = stripNewlines(o.title, 60);
    const safeOrg = stripNewlines(o.organization || '?');
    const safeCountry = stripNewlines(o.country || '?');
    console.log(`${(i + 1).toString().padStart(2)}. ${verdictEmoji(s.verdict)} ${s.score.toString().padStart(3)}/100  ${safeTitle}`);
    console.log(`    ${safeOrg} · ${safeCountry}${o.deadline ? ' · ' + o.deadline : ''}`);
  }

  const topN = sorted.slice(0, args.top).map(o => ({
    title: o.title,
    score: o.score.score,
    verdict: o.score.verdict,
    url: o.url,
    source: o.source,
  }));
  console.log('__TOPN__ ' + JSON.stringify(topN));
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
