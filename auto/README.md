# auto/ — Universal Job Application Pipeline

Modular automation that takes a job URL → tailored CV + cover letter → filled form → confirmation, across multiple ATS platforms.

## Design principles

1. **One CLI, any ATS.** `node auto/apply.mjs <url>` works for Ashby, Greenhouse, Lever (others extendable).
2. **Works without LLM API key** (baseline mode: templating + heuristics). Works *better* with LLM (Claude API or Gemini).
3. **Per-job approve gate is mandatory.** Pipeline halts before submit — Playwright screenshot + console prompt — user types `go` to submit.
4. **Profile is single source of truth.** `config/profile.yml` holds everything: PII, work auth, salary bands, why-us templates.
5. **Stateless per run.** Output goes to `tmp/runs/<date>/<company-role>/` — re-runnable, debuggable.

## Layers

```
URL
 │
 ▼
ats/detect.mjs ──► ats/<platform>.mjs ──► { jobMeta, formSchema }
 │                                              │
 │                                              ▼
 │                                       qa/match.mjs ──► { answers }
 │                                              │
 ▼                                              │
ai/score.mjs (LLM) ──► score (skip if < threshold)
 │
 ▼
cv/render.mjs + ai/tailor-cv.mjs ──► tailored CV HTML ──► generate-pdf.mjs ──► CV PDF
                                          (same for cover letter)
 │
 ▼
ats/<platform>.fill(formSchema, answers, files) ──► browser open, fields filled, screenshot
 │
 ▼
🚦 USER APPROVE GATE (console prompt)
 │
 ▼
ats/<platform>.submit() ──► confirmation screenshot + text saved
```

## ATS adapter contract (`ats/base.mjs`)

Every adapter must implement:

```js
{
  type: 'ashby' | 'greenhouse' | 'lever' | ...,
  fetchJobMeta(url) → { title, company, location, jdText, applyUrl }
  inspectForm(page) → [{ id, label, type, required, options? }, ...]
  fillForm(page, schema, answers, { cvPath, clPath }) → void
  submit(page) → { success, confirmationText, screenshotPath }
}
```

## AI client contract (`ai/client.mjs`)

```js
ai.complete({ system, prompt, json? }) → string | object
```

- Auto-detects provider from env vars: `ANTHROPIC_API_KEY` → Claude, else `GEMINI_API_KEY` → Gemini, else **baseline mode** (no LLM — falls back to templating).
- Per-call: tries Claude first if both keys set; configurable via `LLM_PROVIDER` env.

## CLI

```bash
# Apply to one job
node auto/apply.mjs https://jobs.ashbyhq.com/company/uuid

# Dry-run (no submit, just screenshot)
node auto/apply.mjs <url> --dry-run

# Batch from shortlist
node auto/apply.mjs --batch tmp/batch.json

# Re-run from a previous run dir
node auto/apply.mjs --replay tmp/runs/2026-05-15/synthesia-commercial-data-scientist
```

## Adding a new ATS

1. Create `auto/ats/<name>.mjs` extending `base.mjs`
2. Implement: `fetchJobMeta`, `inspectForm`, `fillForm`, `submit`
3. Register URL pattern in `auto/ats/detect.mjs`
4. Test: `node auto/apply.mjs <test-url> --dry-run`

## Adding a new field type

1. Update `qa/match.mjs` with the field-type → answer-source mapping
2. Update each `ats/*.fill()` to handle the new element type (dropdown, multi-select, etc.)
