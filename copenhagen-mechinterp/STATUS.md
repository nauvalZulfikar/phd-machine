# Copenhagen — PhD Mech Interp for LLM Security

**Deadline:** 2026-05-31 (12 days from 2026-05-19)
**Programme:** PhD Fellowship in Mechanistic Interpretability for LLM Security (ref 160571)
**Supervisor:** Prof. Isabelle Augenstein (`augenstein@di.ku.dk`) + Pepa Atanasova
**Portal:** https://employment.ku.dk/phd/?show=160571 (⚠️ SSL-blocked from local machine — verify via browser)
**Funding:** Fully funded 3yr (Independent Research Foundation Denmark)
**Start:** 2026-09-01
**Research themes:** Mechanistic interpretability, LLM security, false-info mitigation, explainable AI

## 🟢 Fit assessment

**STRONG.** MSc-level (you qualify), Augenstein's NLP lab, mech-interp is a hot topic with
clear connection to your transformer fine-tuning (DeBERTa-v3) + dissertation on LLM
behavioural analysis. Best draft-reuse from Vienna.

## Required docs

| Doc | Action | Source / Note |
|---|---|---|
| CV | 🟡 **BUILD** — emphasise transformer fine-tuning + interp-curious framing + Bank Muamalat post-deploy monitoring | `drafts/cv.md` |
| Cover letter / motivation | 🟡 **BUILD** — Augenstein + Atanasova-themed; reference their CopeNLU papers | `drafts/cover_letter.md` |
| **Project description / research proposal (~1-3pp)** | 🟡 **BUILD** — *the* differentiating doc. Lead with how DeBERTa-v3 fine-tune work pivots to mech-interp inquiry on misinformation susceptibility | `drafts/project_description.md` |
| Transcripts BSc | ✅ **REUSE** | `../shared/transcripts/bba_apu_transcript.pdf` + `bba_apu_degree.pdf` |
| Transcripts MSc | ✅ **REUSE** | `../shared/transcripts/msc_aston_transcript.pdf` + `msc_aston_degree.pdf` |
| Publication list | ✅ **REUSE** | `../shared/publications/sport_footwear_ml_paper.pdf` (single item; list in CV) |
| References (typically 2 contacts, not sealed letters at apply time) | ☐ **CONFIRM** with Ammar + Viktor that they're OK to be listed as KU referees | — |

## Optional / nice-to-have

- IELTS — `../shared/certificates/ielts_2023.pdf`
- Writing sample = `../shared/dissertation/msc_dissertation_2024.pdf` (full thesis)

## Build plan (recommended order)

1. ☐ Fix `draft.py` fact_check_fix regex (Ammar email)
2. ☐ Read 2-3 recent Augenstein/Atanasova papers, extract terminology
3. ☐ Draft project description (1-3pp) — manual, NOT LLM-only; this needs your voice
4. ☐ `draft.py copenhagen-mechinterp` → CV + cover letter
5. ☐ `build_pdfs.py copenhagen-mechinterp`
6. ☐ Email Ammar + Viktor: "OK to list you as KU referees?"
7. ☐ Submit on portal (check via browser since SSL-blocked from CLI)
