/**
 * Centralised prompt templates for scoring, CV tailoring, CL gen, Q&A.
 * Keeping all prompts here so they can be tuned without touching plumbing.
 */

export const SYSTEM_JOB_AGENT = `You are a senior career-tooling agent assisting a single candidate (read the profile.yml passed by the caller). You write concise, factual output. You do NOT invent experience the candidate does not have. You prefer measurable language ("+5.3% return") over generic claims. You write in British English. When asked for JSON, you respond with valid JSON only — no prose, no markdown fences.`;

// Scoring prompt — input: JD + profile summary → output: A-F score with reasoning
export function scorePrompt(jd, profileSummary) {
  return `Evaluate fit between candidate and job. Score on 10 dimensions (A=excellent, B=good, C=acceptable, D=poor, F=blocker), output JSON.

CANDIDATE:
${profileSummary}

JOB:
${jd.slice(0, 6000)}

Respond with JSON:
{
  "skill_fit": "A|B|C|D|F",
  "level_fit": "...",
  "location_tz": "...",
  "visa_compatibility": "...",
  "comp_band_fit": "...",
  "growth_potential": "...",
  "company_stability": "...",
  "culture_autonomy": "...",
  "tech_stack_fit": "...",
  "hiring_competition": "...",
  "composite": "A|A-|B+|B|B-|C+|C|D|F",
  "verdict": "GO|REVIEW|SKIP",
  "top_3_strengths": ["...", "...", "..."],
  "top_3_risks": ["...", "...", "..."],
  "blocker": null | "string explaining hard blocker"
}`;
}

// CV tailoring prompt — input: master CV (JSON), JD → output: tailoring directives
export function tailorCvPrompt(profile, jd, jobMeta) {
  return `Tailor a CV for the specific job. Output ONLY the directives — do not rewrite the whole CV. Caller will apply directives to the master template.

PROFILE (master):
${JSON.stringify(profile, null, 2).slice(0, 8000)}

JOB:
Title: ${jobMeta.title}
Company: ${jobMeta.company}
Location: ${jobMeta.location}
JD (truncated):
${jd.slice(0, 5000)}

Respond with JSON:
{
  "summary_text": "1 short paragraph (~80 words), commercial-minded, lead with most relevant 1-2 metrics, mention the target role framing",
  "competencies": ["12 chips, in priority order, matching JD keywords"],
  "job_bullet_overrides": {
    "company_name_1": ["3-4 re-framed bullets, each lead with action verb, end with metric"],
    "company_name_2": ["..."]
  },
  "selected_projects": ["project_name_1", "project_name_2", "project_name_3"],
  "skills_categories": {
    "AI / ML": "comma list",
    "Software": "comma list",
    "Cloud / Infra": "comma list",
    "Analytics & Viz": "comma list",
    "Delivery": "comma list",
    "Languages": "comma list"
  }
}`;
}

// Cover letter prompt
export function tailorClPrompt(profile, jd, jobMeta) {
  return `Write a cover letter for ${jobMeta.company} — ${jobMeta.title}. ~350-450 words. British English. Structure: intro hook tying candidate to role; 3 proof points (each: bold lead, then metric/outcome); honest gap acknowledgement if any; location/visa one-liner; closing question for the hiring team.

PROFILE:
${JSON.stringify(profile, null, 2).slice(0, 6000)}

JOB:
${jd.slice(0, 5000)}

Output ONLY the body text (no header, no signature — those are added by the renderer). Use HTML <p>, <strong>, <em> tags. No <h*> tags.`;
}

// Q&A free-text answer
export function answerFreeTextPrompt(question, profile, jobMeta, jd) {
  return `Answer a job-application free-text question. ~60-120 words. Specific to this company and role. British English. Honest — no invented experience.

QUESTION:
${question}

CANDIDATE PROFILE:
${JSON.stringify({ narrative: profile.narrative, experience: profile.experience }, null, 2)}

JOB:
${jobMeta.company} — ${jobMeta.title}
JD excerpt:
${jd.slice(0, 2500)}

Output plain text only.`;
}

// Build a short profile summary string for scoring (token-efficient)
export function profileSummary(profile) {
  const c = profile.candidate;
  const exp = profile.experience;
  const nar = profile.narrative;
  return [
    `Name: ${c.full_name}, ${profile.location.city}, ${profile.location.country}`,
    `Visa: ${profile.location.visa_status_short} (UK Graduate Visa + EU rights)`,
    `Total YoE: ${exp.years_total}; DS: ${exp.years_data_science}; ML: ${exp.years_machine_learning}; NLP: ${exp.years_nlp}; AWS: ${exp.years_aws}; A/B: ${exp.years_ab_testing}`,
    `Headline: ${nar.headline}`,
    `Exit story: ${nar.exit_story}`,
    `Superpowers: ${(nar.superpowers || []).join('; ')}`,
    `Proof points: ${(nar.proof_points || []).map(p => `${p.name} — ${p.hero_metric}`).join(' | ')}`,
    `Target archetypes: ${(profile.target_roles.archetypes || []).map(a => `${a.name} (${a.fit})`).join(', ')}`,
    `Comp expected: ${profile.compensation.expected_uk_gbp} UK / ${profile.compensation.expected_eu_eur} EU / ${profile.compensation.expected_us_usd} US`,
  ].join('\n');
}
