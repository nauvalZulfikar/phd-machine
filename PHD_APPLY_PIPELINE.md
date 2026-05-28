# PhD Application Pipeline — Phases & Agents

10-phase generic flow, distilled from the Aston p196342 application.
Each phase = one specialized agent, single responsibility, clean inputs/outputs.

---

## The 10 Phases

```
0. DISCOVER     → find candidate postings
1. SCOPE        → read 1 posting, extract required docs + constraints
2. SUPERVISOR   → research target supervisor + recent papers
3. GAP          → asset inventory: what exists vs what's needed
4. DRAFT        → write missing docs (cover, RS, PS, etc.)
5. PRE-CONTACT  → optional email to supervisor before submitting
6. REFEREES     → secure + brief referees, track their submissions
7. PDF BUILD    → md → PDF with template CSS, embed figures
8. PORTAL FILL  → automate form filling via Playwright
9. UPLOAD       → upload docs into portal upload widgets
10. SUBMIT+LOG  → final review, click submit, log to applications.jsonl
11. FOLLOWUP    → ping referees / hiring committee at agreed date
```

---

## Phase-by-phase, with agent concept

### Phase 0 — DISCOVER (already built)
**Agent:** `discoverer` (existing: `auto/discover.mjs`)
- Inputs: keyword config, country filter
- Outputs: `opportunities.jsonl` + daily digest
- Aston example: pulled p196342 from FindAPhD scrape
- **Not part of per-app loop** — runs as cron.

### Phase 1 — SCOPE (currently manual)
**Agent:** `posting-scoper`
- **One job:** read 1 posting URL, output structured requirements
- **Input:** opportunity ID (or URL)
- **Output:** `apps/<opp-id>/REQUIREMENTS.json`:
  ```json
  {
    "ref": "5509",
    "deadline": "2026-05-20",
    "supervisor": "Pawelczyk",
    "supervisor_email": "martin.pawelczyk@univie.ac.at",
    "portal_url": "...",
    "required_docs": ["cv", "cover_letter", "thesis_abstract", "bachelor_transcript", "master_transcript"],
    "optional_docs": [],
    "constraints": {"start_date_window": "Jun-Oct 2026", "language": "EN"}
  }
  ```
- **Tools:** WebFetch, Write
- **Aston example:** the user manually scoped FindAPhD p196342; output became the implicit checklist driving the entire MICRO_PHASES.md plan.

### Phase 2 — SUPERVISOR (currently manual)
**Agent:** `supervisor-researcher`
- **One job:** find supervisor's recent papers, group page, themes, citation count
- **Input:** supervisor name + university
- **Output:** `apps/<opp-id>/SUPERVISOR_BRIEF.md`:
  - Recent 5 papers w/ themes
  - Group/lab page link
  - Citing-which-papers (relevance to user)
  - Hook phrases to use in cover letter
- **Tools:** WebFetch, WebSearch
- **Aston example:** user manually identified Dr. Al-Bazi + Dr. Sajadi's hybrid ABM+DES paper line; that fed `research_statement.md` Section 9 ("Why Aston").

### Phase 3 — GAP (currently manual, half-automatable)
**Agent:** `gap-analyzer`
- **One job:** diff REQUIREMENTS vs existing assets
- **Input:** REQUIREMENTS.json + `data/knowledge/` asset list + `phd_aston_prep/application/documents/`
- **Output:** `apps/<opp-id>/GAP.md`:
  ```
  REUSE:
   - bba_apu_transcript.pdf ← phd_aston_prep/.../documents/
   - msc_aston_transcript.pdf ← idem

  BUILD:
   - cover_letter (Pawelczyk-specific, mention multi-agent LLM safety)
   - thesis_abstract (DeBERTa-v3 → smart contract pipeline)
   - cv (re-headlined: drop transport, lead NLP/LLM)

  SKIP:
   - personal_statement (Aston wanted it, Vienna doesn't)
   - research_statement (idem)
   - reference_letters (not requested at application stage)
  ```
- **Tools:** Read, Glob, Write
- **Aston example:** `GAP_ANALYSIS.md` + `MICRO_PHASES.md` did exactly this for p196342. **This is the agent that would have prevented gua over-engineering Vienna.**

### Phase 4 — DRAFT (currently manual; LLM-assisted)
**Agent:** `draft-writer`
- **One job:** generate the BUILD list from Phase 3, one doc at a time
- **Input:** GAP.md + SUPERVISOR_BRIEF.md + `data/knowledge/profile.yaml` + base RS/PS/CV from `phd_aston_prep/`
- **Output:** `apps/<opp-id>/drafts/*.md`
- **Procedure:** for each missing doc, generate via gpt-4o-mini using doc-specific prompt template (cover prompt, RS prompt, etc.)
- **Tools:** Read, Write, Bash (OpenAI API)
- **Aston example:** user wrote cv_phd.md, personal_statement.md, research_statement.md by hand. Multi-day work; the agent would do it in 1 LLM call per doc.

### Phase 5 — PRE-CONTACT (optional, high yield)
**Agent:** `supervisor-emailer`
- **One job:** generate + send (or display for copy-paste) a short pre-application email to supervisor
- **Input:** SUPERVISOR_BRIEF + draft cover letter
- **Output:** `apps/<opp-id>/supervisor_email.md` — 5 lines, asks for 15-min call OR confirmation of fit
- **Tools:** Write, optional MCP-gmail
- **Aston example:** user emailed Ammar before submitting → Ammar approved → reference 0656416 issued before deadline. **This is what made Aston competitive.**

### Phase 6 — REFEREES (currently manual)
**Agent:** `referee-coordinator`
- **One job:** match REQUIREMENTS to existing referee briefs, generate ping email if reference needed at application stage
- **Input:** REQUIREMENTS.referee_count + `references.md` (Ammar=Referee 1, Viktor=Referee 2)
- **Output:** `apps/<opp-id>/referee_status.md`:
  - Who needs to act, by when
  - Reference upload URLs (if portal generates them)
  - Email template to send to referee
- **Tools:** Read, Write, optional MCP-gmail
- **Aston example:** `reference_brief.md`, `fix_referees.py`, `fix_address_viktor.py` were all manual ad-hoc fixes. Agent would standardize.

### Phase 7 — PDF BUILD (already prototyped)
**Agent:** `pdf-builder`
- **One job:** convert all MD drafts in `apps/<opp-id>/drafts/` to template-consistent PDFs
- **Input:** drafts dir + template CSS (same as Aston: Calibri/Calibri Light, #2F5496/#1F3864, A4)
- **Output:** `apps/<opp-id>/documents/*.pdf`
- **Procedure:** Playwright headless Chromium + markdown-it; inline SVG figures + base64 raster images
- **Tools:** Bash (python script), Read
- **Aston example:** `md_to_pdf.py` did exactly this; my `build_pdfs.py` for Vienna is a copy.

### Phase 8 — PORTAL FILL (already prototyped, per-portal)
**Agent:** `portal-filler` (per-portal subagent)
- **One job:** drive the Playwright browser to fill text fields, select dropdowns
- **Input:** portal URL + REQUIREMENTS + `data/knowledge/profile.yaml`
- **Output:** `apps/<opp-id>/portal_session/state.json` (cookies, form state)
- **Procedure:** open portal → login if needed → fill section by section → save state per page
- **Tools:** Playwright (Bash), Read
- **Sub-agents needed per portal:** `portal-filler-sits` (Aston, Cranfield), `portal-filler-univie`, `portal-filler-ellis-ats`, etc.
- **Aston example:** `apply_full.py`, `apply_recon.py`, `apply_step2.py`, `fill_application.py`, `recon_all_sections.py` — all SITS-specific. Reusable for any UK uni on SITS.

### Phase 9 — UPLOAD (already prototyped)
**Agent:** `doc-uploader`
- **One job:** upload each PDF to the right portal upload widget
- **Input:** `apps/<opp-id>/documents/` + portal upload widget mapping
- **Output:** confirmation that each doc shows as uploaded in portal
- **Procedure:** match doc filename to widget label, drag-drop via Playwright `setInputFiles()`
- **Tools:** Playwright (Bash)
- **Aston example:** `upload_ielts.py`, `upload_qual_docs.py`, `upload_qual_docs_v2.py`, `upload_transcripts.py` — split into one script per widget because each had quirks. Agent would unify.

### Phase 10 — SUBMIT + LOG
**Agent:** `submit-logger`
- **One job:** final pre-submit checklist → click submit → log to `applications.jsonl`
- **Input:** `apps/<opp-id>/REQUIREMENTS.json` + portal state
- **Output:** appended row to `data/academic/applications.jsonl`:
  ```json
  {"oppId":"univie-5509","submittedAt":"2026-05-19","status":"submitted",
   "portal":"univie","ref":"5509","deadline":"2026-05-20",
   "followupDate":"2026-06-03","notes":"..."}
  ```
- **Procedure:** human-in-loop checklist (print summary, wait for `y/n`) → submit → log
- **Tools:** Read, Write, Playwright
- **Aston example:** `P8_USER_CHECKLIST.md` was the manual version of this.

### Phase 11 — FOLLOWUP
**Agent:** `followup-pinger`
- **One job:** ping at the followup date (referee chase, decision check, polite nudge)
- **Input:** `applications.jsonl` row + today's date
- **Output:** email draft + status field update
- **Trigger:** cron / `pm2` job, daily at 09:00 local
- **Tools:** Read, Write, optional MCP-gmail
- **Aston example:** scheduled for 29 May 2026 (currently pending).

---

## Folder shape per application

```
career-ops/data/academic/apps/<opp-id>/
├── REQUIREMENTS.json          ← Phase 1
├── SUPERVISOR_BRIEF.md        ← Phase 2
├── GAP.md                     ← Phase 3
├── drafts/                    ← Phase 4
│   ├── cover_letter.md
│   ├── thesis_abstract.md
│   └── cv.md
├── supervisor_email.md        ← Phase 5 (optional)
├── referee_status.md          ← Phase 6
├── documents/                 ← Phase 7 (PDFs)
│   ├── cover_letter.pdf
│   ├── thesis_abstract.pdf
│   └── cv.pdf
├── portal_session/            ← Phase 8 (Playwright state)
└── submitted.json             ← Phase 10
```

Existing `career-ops/data/academic/drafts/` and `phd_aston_prep/application/` are the **historical record**; new apps should write into `apps/<opp-id>/`.

---

## Agent definition files (where to put them)

```
career-ops/.claude/agents/
├── posting-scoper.md
├── supervisor-researcher.md
├── gap-analyzer.md
├── draft-writer.md
├── supervisor-emailer.md
├── referee-coordinator.md
├── pdf-builder.md
├── portal-filler-sits.md       ← per-portal sub-agent
├── portal-filler-univie.md
├── doc-uploader.md
├── submit-logger.md
└── followup-pinger.md
```

Each agent file follows `~/.claude/agents/deployer-template.md` shape: frontmatter `name/description/tools/model`, then `Procedure / Rules / Reporting`.

**Tiering:**
- `opus` (judgment-heavy): `gap-analyzer`, `draft-writer`, `submit-logger`
- `sonnet` (default): `posting-scoper`, `supervisor-researcher`, `supervisor-emailer`, `referee-coordinator`
- `haiku` (mechanical): `pdf-builder`, `portal-filler-*`, `doc-uploader`, `followup-pinger`

---

## Orchestration

One top-level slash command: `/apply <opp-id>` runs phases 1→10 sequentially, with human-in-loop pause after Phase 4 (draft review) and Phase 10 (final submit confirm).

For batch: `/apply-batch <opp-id-1> <opp-id-2> ...` runs each in its own folder, sharing the same draft-writer prompts for consistency.

---

## What this would have changed for Vienna

Going through the 10 phases retroactively:

| Phase | What I did | What the agent would have done |
|---|---|---|
| 1 SCOPE | Fetched posting after 2 wrong-format passes | One WebFetch, structured REQUIREMENTS.json → done |
| 2 SUPERVISOR | Skipped | Would have surfaced Pawelczyk's in-context-unlearning paper, cited it in cover |
| 3 GAP | Skipped → over-engineered | Would have said "skip PS + RS" immediately, saved ~2h of drafting |
| 4 DRAFT | Did all 5 docs (3 useful) | Would have done 3 |
| 5 PRE-CONTACT | Skipped | Would have produced supervisor_email.md to send 4 days before deadline |
| 6 REFEREES | N/A (Vienna doesn't request at this stage) | Would have flagged this is N/A and moved on |
| 7 PDF BUILD | ✅ Done (build_pdfs.py) | Same |
| 8 PORTAL FILL | Pending | Per-portal subagent for univie.ac.at |
| 9 UPLOAD | Pending | doc-uploader |
| 10 SUBMIT+LOG | Pending | submit-logger |
| 11 FOLLOWUP | Not yet scheduled | Auto-scheduled at submit time |

**The savings:** Phase 3 alone would have prevented gua writing 2 unnecessary docs + 1 SVG. The whole flow turns a 5-hour artisanal application into a 20-min reviewed-submission.

---

## Next 4 PhD apps in queue

Re-use same pipeline:
- **#41 UKP Darmstadt** (deadline 31 May) — postdoc, likely different docs (research plan + 2 ref letters)
- **#42 Copenhagen Mech Interp** (deadline 31 May) — PhD, similar to Vienna
- **#43 Aarhus TTA** (deadline 1 Jun) — PhD, similar to Vienna
- **#45 PoliMi RAI/CSS** (deadline 15 Jun) — PhD, Milan = no relocation friction

Each one starts at Phase 1 (`posting-scoper`) and runs through Phase 10 (`submit-logger`).

---

*Last updated: 2026-05-17. Source: distilled from `phd_aston_prep/application/` artefacts + Vienna application work this session.*
