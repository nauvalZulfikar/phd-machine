/**
 * Q&A field matcher.
 * For each form field, returns the appropriate answer by:
 *   1. Hard-coded field-id mapping for known ATS fields (resume, email, etc.)
 *   2. Heuristic match against profile.qa_hints (regex → profile path or template)
 *   3. LLM free-text generation for the rest (if API available; baseline: skip with warning)
 */
import { complete, isBaseline } from '../ai/client.mjs';
import { SYSTEM_JOB_AGENT, answerFreeTextPrompt } from '../ai/prompts.mjs';

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `[${k}]`);
}

/** Extract the regex from a profile.qa_hints pattern string "/.../i" */
function parsePattern(p) {
  const m = p.match(/^\/(.*)\/([gimsuy]*)$/);
  return m ? new RegExp(m[1], m[2]) : new RegExp(p, 'i');
}

/** Match a field's label against profile.qa_hints and return the answer (or undefined). */
function matchHeuristic(field, profile) {
  const hints = profile.qa_hints || [];
  for (const h of hints) {
    const re = parsePattern(h.pattern);
    if (re.test(field.label) || re.test(field.id || '')) {
      if (h.source) {
        const v = getPath(profile, h.source);
        if (v !== undefined) return v;
      }
      if (h.template && profile.qa_templates?.[h.template]) {
        return profile.qa_templates[h.template]; // unresolved; LLM/templater can fill placeholders
      }
      if (h.default !== undefined) return h.default;
    }
  }
  return undefined;
}

/** Generate free-text answer via LLM (or return empty string in baseline). */
async function generateFreeText(field, profile, jobMeta) {
  if (isBaseline()) return '';
  try {
    const ans = await complete({
      system: SYSTEM_JOB_AGENT,
      prompt: answerFreeTextPrompt(field.label, profile, jobMeta, jobMeta.jdText || ''),
      maxTokens: 600,
    });
    if (typeof ans === 'object' && ans.__baseline) return '';
    return String(ans).trim();
  } catch (e) {
    console.log(`  ⚠ Free-text LLM failed for "${field.label}": ${e.message}`);
    return '';
  }
}

const FREE_TEXT_TRIGGER = /textarea|excit|why|tell us|describe|what (about|interests|brings)|how (would|can|do)|examples?|story|biggest|challenge|achievement|favourite|favorite/i;

/**
 * Resolve answers for all fields.
 * Returns: { fieldId → answer-value }
 */
export async function resolveAnswers(schema, profile, jobMeta) {
  const answers = {};
  for (const field of schema) {
    // Skip files — handled separately by adapter via files arg
    if (field.type === 'file') continue;

    // 1. Heuristic match
    let value = matchHeuristic(field, profile);

    // Resolve template placeholders if matched a template string
    if (typeof value === 'string' && value.includes('{{')) {
      // Heuristic COMPANY_FOCUS: pick from job department or top JD verb noun
      const focus = jobMeta.department
        || (jobMeta.jdText || '').match(/build(?:ing)?\s+([^.\n]{10,60})/i)?.[1]?.trim()
        || 'building production AI products';
      const topBullet = (jobMeta.jdText || '').split('\n')
        .map(l => l.replace(/^\s*[-•]\s*/, '').trim())
        .find(l => l.length > 30 && l.length < 200)
        || 'shipping production ML to commercial outcomes';
      value = fillTemplate(value, {
        COMPANY: jobMeta.company,
        ROLE: jobMeta.title,
        COMPANY_FOCUS: focus,
        TOP_RELEVANT_EXPERIENCE: 'production ML at Bank Muamalat + UK marketing DS at Syncwell',
        TOP_JD_BULLET: topBullet,
        ADDITIONAL_HOOK: 'I also enjoy translating ambiguous problems into measurable models that ship.',
      });
    }

    // 2. Free-text LLM fallback for textarea-style / open Qs
    if (value === undefined && (field.type === 'textarea' || FREE_TEXT_TRIGGER.test(field.label))) {
      value = await generateFreeText(field, profile, jobMeta);
    }

    if (value !== undefined && value !== '') answers[field.id] = value;
  }
  return answers;
}
