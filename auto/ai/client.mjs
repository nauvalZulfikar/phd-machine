/**
 * LLM client abstraction.
 *
 * Provider priority (env-controlled, default: anthropic → gemini → baseline):
 *   ANTHROPIC_API_KEY  → Claude
 *   GEMINI_API_KEY     → Gemini
 *   (neither)          → baseline mode (returns template — caller must handle)
 *
 * API:
 *   await ai.complete({ system, prompt, json = false, maxTokens = 2000 })
 *     → string (text) or object (if json: true)
 *
 * Baseline mode returns: { __baseline: true, prompt } so callers can decide
 * to use static templates instead of erroring out.
 */

const PROVIDER = process.env.LLM_PROVIDER
  || (process.env.ANTHROPIC_API_KEY ? 'anthropic'
    : process.env.OPENAI_API_KEY ? 'openai'
      : process.env.GEMINI_API_KEY ? 'gemini'
        : 'baseline');

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

export const aiMeta = { provider: PROVIDER };

async function callClaude({ system, prompt, json, maxTokens }) {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: json ? `${prompt}\n\nRespond with valid JSON only, no prose, no code fences.` : prompt }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  return json ? safeParseJSON(text) : text;
}

async function callOpenAI({ system, prompt, json, maxTokens }) {
  const body = {
    model: OPENAI_MODEL,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: json ? `${prompt}\n\nRespond with valid JSON only, no prose, no code fences.` : prompt },
    ],
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return json ? safeParseJSON(text) : text;
}

async function callGemini({ system, prompt, json, maxTokens }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: system || '' }] },
    contents: [{ role: 'user', parts: [{ text: json ? `${prompt}\n\nRespond with valid JSON only.` : prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return json ? safeParseJSON(text) : text;
}

function safeParseJSON(text) {
  // Strip code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
  try { return JSON.parse(cleaned); } catch { return { __parseError: true, raw: text }; }
}

export async function complete({ system = '', prompt, json = false, maxTokens = 2000 }) {
  if (PROVIDER === 'anthropic') return callClaude({ system, prompt, json, maxTokens });
  if (PROVIDER === 'openai') return callOpenAI({ system, prompt, json, maxTokens });
  if (PROVIDER === 'gemini') return callGemini({ system, prompt, json, maxTokens });
  // baseline mode
  return { __baseline: true, system, prompt };
}

export function isBaseline() {
  return PROVIDER === 'baseline';
}
