# Pilot E2E Report — 2026-05-14

**Goal:** Apply to 1 real senior data role end-to-end, AI-tailored, fully scripted, with confirmation captured.

**Target:** Synthesia · Commercial Data Scientist · Europe Remote
**Outcome:** ✅ SUBMITTED — Synthesia confirmation page captured.

## Time per fase

| Fase | What | Auto? | Wall time | Notes |
|---|---|---|---|---|
| 1. Source | `node scan.mjs` Greenhouse + Ashby + Lever | ✅ | ~3 min | 104 remote roles; manual curation to top 7 |
| 2. Evaluate | A-F scoring report against JD | 🟡 AI-assisted, manual write | ~5 min | Needs Claude judgment, not yet scripted |
| 3. CV tailoring | HTML template + tailored content + `generate-pdf.mjs` | 🟡 AI-assisted | ~8 min | HTML hand-written; PDF gen scripted |
| 4. Cover letter | Same HTML+PDF flow | 🟡 AI-assisted | ~5 min | |
| 5. Q&A prep | Field inspection + answer mapping | ✅ | ~3 min | `inspect-synthesia-form.mjs` script |
| 6. Form fill | Playwright `fill-synthesia-form.mjs` (no --submit) | ✅ | ~30 sec | Issue: Ashby uses `id` not `name` for some inputs; visa Qs are buttons not checkboxes |
| 7. Review gate | Screenshot to user | 🟡 manual | user-paced | |
| 8. Submit + verify | Same script with `--submit` | ✅ | ~30 sec | Ashby SPA: URL unchanged, success div appears in-place — selector must match success TEXT not URL change |

**Total wall time:** ~25 min (lots in eval + tailoring; submission itself ~30s).

## What works fully scripted (re-usable for next apply)

- ✅ Greenhouse + Ashby + Lever portal scanning (`scan.mjs`)
- ✅ Form inspection (`inspect-*-form.mjs`) — reusable pattern for any Ashby/Greenhouse form
- ✅ HTML → PDF generation (`generate-pdf.mjs`)
- ✅ Playwright form fill with file upload, typeahead location, button-based Yes/No
- ✅ Confirmation screenshot capture (success-text detection, not URL change)

## What's still manual (top candidates for Superapp Fase 1)

1. **JD → CV tailoring (Fase 3)** — currently hand-edited HTML. **Build:** prompt template that takes JD + master cv.md → outputs tailored HTML. Effort: 1-2 wk.
2. **JD → Cover letter (Fase 4)** — hand-written. **Build:** same prompt-template approach with company research injection. Effort: 1 wk.
3. **Form-fill script per ATS** — currently hand-coded selectors. **Build:** universal Ashby/Greenhouse fill-from-config, given a Q&A YAML. Effort: 2-3 wk.
4. **Scoring A-F (Fase 2)** — currently AI-judgment by hand. **Build:** scoring prompt with 10-dim rubric output as YAML; auto-tracked in pipeline. Effort: 1 wk.
5. **Source filtering** — `scan.mjs` returns all matches; manual filter for remote/EU/seniority. **Build:** location_filter + seniority_filter in portals.yml + auto-rank. Effort: 3 days.

## Surprises during pilot

- **Synthesia form is unusually minimal** — no salary, no "why this company?", no notice period. Ashby default form. Most Greenhouse forms have more Qs.
- **Ashby visa Qs are buttons, not checkboxes** — initial inspection misled by hidden checkbox name attr. Fixed by inspecting buttons via index.
- **Resume input has `id` not `name`** — generic `input[name="_systemfield_resume"]` selector fails. Use `#_systemfield_resume`.
- **Location is typeahead with autocomplete** — must type partial, wait, click dropdown. Plain `fill()` may submit raw text that doesn't pass validation.
- **Ashby is SPA** — submit doesn't change URL. Detect success via text "Your application was successfully submitted".

## Recommended next 4 weeks (Superapp Fase 1)

Priority order based on time-saved-per-apply:

1. **Week 1:** AI tailoring prompts (CV + CL) — saves ~13 min/apply
2. **Week 2:** Scoring A-F automation + auto-rank — saves ~5 min/apply
3. **Week 3:** Universal Ashby/Greenhouse fill-from-config — saves ~5 min/apply on new ATS
4. **Week 4:** location_filter + seniority_filter in scan — cleans up source step

**After Fase 1:** end-to-end apply per role drops from ~25 min to ~3-5 min (mostly review gates).

## Per-application metrics for tracking

- ✅ 1 real application submitted today
- 1 confirmation captured
- 0 errors at runtime (after 2 selector iterations)
- 4 hand-written deliverables (CV, CL, eval, Q&A) — would have been 0 with Superapp Fase 1
