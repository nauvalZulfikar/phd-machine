# Aarhus — PhD Test-Time Adaptation & Agentic AI

**Deadline:** 2026-06-01 (13 days from 2026-05-19)
**Programme:** PhD in Test-Time Adaptation & Agentic AI (A3 Lab, Dept of Electrical & Computer Engineering)
**Supervisor:** Assoc. Prof. Behzad Bozorgtabar (`behzad@ece.au.dk`)
**Portal:** https://phd.tech.au.dk/for-applicants/apply-here/saeropslag/phd-position-in-test-time-adaptation-and-agentic-ai
**Funding:** Funded
**Start:** 2026-08-01
**Research themes:** Test-time adaptation, agentic decision-making, multimodal foundation models

## 🟡 Fit assessment

**MODERATE.** Eligibility says "strong background in ML and/or computer vision". Your
profile is heavier on NLP/transformers + decision-systems than computer vision. Still
worth applying — TTA is more general than CV, and agentic angle plays to your LLM agent +
mesa ABM + Digital Twin work.

## Required docs (LEAN — only 4!)

| Doc | Action | Source / Note |
|---|---|---|
| CV | 🟡 **BUILD** — emphasise ML + agentic projects (LLM-Shipper-Profiles, Mini Digital Twin) | `drafts/cv.md` |
| Cover letter (**1-page limit**) | 🟡 **BUILD** — tight, single page, framed around TTA + agentic | `drafts/cover_letter.md` |
| **1-page Statement of Interest** | 🟡 **BUILD** — separate from cover letter; specifically about your research interest in TTA + agentic AI | `drafts/statement_of_interest.md` |
| Transcripts MSc | ✅ **REUSE** | `../shared/transcripts/msc_aston_transcript.pdf` |

## Optional

- Publication list — `../shared/publications/sport_footwear_ml_paper.pdf`
- BSc transcripts — `../shared/transcripts/bba_apu_*.pdf` (not requested but typical to attach)

## Build plan

1. ☐ Fix `draft.py` fact_check_fix regex
2. ☐ Draft 1pp Statement of Interest — manual + LLM-assisted
3. ☐ `draft.py aarhus-tta` → CV + 1pp cover letter
4. ☐ `build_pdfs.py aarhus-tta`
5. ☐ Submit on portal
