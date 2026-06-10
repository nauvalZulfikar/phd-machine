# UKP InterText Postdoc — TU Darmstadt

**Deadline:** 2026-05-31 (12 days from 2026-05-19)
**Programme:** Postdoctoral Researcher — ERC Advanced Grant *InterText*
**Supervisor:** Prof. Dr. Iryna Gurevych (`iryna.gurevych@tu-darmstadt.de`)
**Portal:** https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment
**Funding:** TV-H E13 (typical ~€55–65k/yr gross), contract 2yr + extension
**Research themes:** Multi-doc reasoning, long-context LLMs, AI for Science, fact-checking, agentic LLMs

## ⚠️ Eligibility risk

> "PhD (completed or near completion) in NLP, ML, Computer Science, or related discipline."

You hold an MSc, not a PhD or near-PhD. **Recommend: email Iryna FIRST** to ask whether the
InterText programme has a PhD-track variant or whether ABDs are eligible. Don't burn drafting
cycles unless she signals openness.

## Required docs

| Doc | Action | Source |
|---|---|---|
| CV | 🟡 **BUILD** — adapt Aston/Vienna CV for UKP (lead with NLP/transformer projects, de-emphasise transport) | `drafts/cv.md` (to draft) |
| Cover letter | 🟡 **BUILD** — InterText-themed, frame MSc dissertation as "fine-tuning LLMs on supply-chain text = applied multi-doc reasoning" | `drafts/cover_letter.md` (to draft) |
| Transcripts BSc | ✅ **REUSE** | `../shared/transcripts/bba_apu_transcript.pdf` + `bba_apu_degree.pdf` |
| Transcripts MSc | ✅ **REUSE** | `../shared/transcripts/msc_aston_transcript.pdf` + `msc_aston_degree.pdf` |
| Reference letters | 🔴 **MANUAL** — ask Ammar + Viktor to refresh letter (existing Ammar letter targets PoliMi, would need readdressing). Or request that referees write directly to UKP via portal. | (request) |

## Optional / nice-to-have

- IELTS — `../shared/certificates/ielts_2023.pdf`
- Publication list — see `../shared/publications/sport_footwear_ml_paper.pdf` (single working paper)
- Dissertation PDF — `../shared/dissertation/msc_dissertation_2024.pdf`

## Build plan

1. ☐ Email Iryna (3-line inquiry on PhD-track eligibility) — **do this first**
2. ☐ If green light: run `draft.py ukp-intertext` (after fixing fact_check_fix regex)
3. ☐ Manually rebalance CV project order
4. ☐ Build PDFs via `build_pdfs.py ukp-intertext`
5. ☐ Request referee re-letters (lead time 5-7d) — start no later than 2026-05-24
