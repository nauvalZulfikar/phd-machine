# PhD Applications — Master Index

Canonical home for all PhD/postdoc applications, replacing scattered locations
(`phd_aston_prep/`, `career-ops/data/academic/apps/`, `PhD Polimi 2026/`).

**Owner:** Nauval Zulfikar (`zulfikar.nauval1998@gmail.com`)
**Last refreshed:** 2026-05-19

---

## Layout

```
phd-applications/
├── README.md                       ← master dashboard
├── shared/                         ← reusable across ALL apps
│   ├── profile.yaml                ← canonical (synced from career-ops/data/knowledge/)
│   ├── photo/profile_photo.jpg
│   ├── transcripts/                ← BBA + MSc degree + transcript PDFs (4)
│   ├── certificates/               ← IELTS, passport, UK graduate visa
│   ├── dissertation/               ← MSc thesis full PDF
│   ├── publications/               ← working paper(s)
│   └── references/                 ← Ammar + Viktor signed reference letters
│
└── <opp-id>/                       ← per-opportunity folder
    ├── REQUIREMENTS.json           ← scoped from posting
    ├── STATUS.md                   ← gap analysis + countdown
    ├── BUILD_CONFIG.yaml           ← for tools/build_pdfs.py
    ├── GAP.md                      ← auto-generated gap report
    ├── drafts/                     ← markdown source
    └── documents/                  ← final PDFs to upload
```

---

## Opportunity dashboard (2026-05-19)

| # | Opp | Deadline | Days | Built | Fit |
|---|---|---|---|---|---|
| 1 | [aston-p196342](aston-p196342/STATUS.md) | 2026-05-18 | -1 | ✅ Submitted 2026-05-17 | A — baseline |
| 2 | [univie-5509](univie-5509/STATUS.md) (Vienna) | 2026-05-20 | +1 | ⏭️ Skipped | B |
| 3 | [ukp-intertext](ukp-intertext/STATUS.md) | 2026-05-31 | +12 | ✅ 2 PDFs | ⚠️ postdoc eligibility risk |
| 4 | [copenhagen-mechinterp](copenhagen-mechinterp/STATUS.md) | 2026-05-31 | +12 | ✅ 3 PDFs | 🟢 strong |
| 5 | [aarhus-tta](aarhus-tta/STATUS.md) | 2026-06-01 | +13 | ✅ 3 PDFs | 🟡 moderate |
| 6 | [chalmers-agentic-monitoring](chalmers-agentic-monitoring/STATUS.md) | ~2026-06-12 | +24 | ✅ 3 PDFs | 🟡 moderate-good |
| 7 | [polimi-pierri](polimi-pierri/STATUS.md) | ~2026-06-15 | +27 | ✅ 3 PDFs | 🔵 inquiry needed |
| 8 | [cambridge-llm-safety](cambridge-llm-safety/STATUS.md) | 2026-07-30 | +72 | ✅ 2 PDFs | 🟢 strong |
| 9 | [tubingen-andriushchenko](tubingen-andriushchenko/STATUS.md) | rolling | — | ✅ 3 PDFs + email | 🟡 stretch |
| 10 | [mcml-munich](mcml-munich/STATUS.md) | TBD | — | — | needs cycle check |

**Total: 26 PDFs built across 8 apps + Aston (12) + Vienna (2) = 40 documents.**

---

## Pipeline tools (in `career-ops/`)

```bash
cd "D:/Downloads/coding project/career-ops"
python tools/scope.py <posting_url>           # → REQUIREMENTS.json
python tools/gap.py   data/academic/apps/<opp-id>  # → STATUS.md + BUILD_CONFIG.yaml
python tools/draft.py data/academic/apps/<opp-id>  # → drafts/*.md (LLM + fact-check)
python tools/build_pdfs.py data/academic/apps/<opp-id>  # → documents/*.pdf
```

All apps use the Aston-style template (uk-academic = Calibri + Word-blue + photo).
Aston `cv_phd.md` / `personal_statement.md` / `research_statement.md` are loaded as
REFERENCE STYLE inside the LLM system prompt for every new draft (`draft.py:load_reference_doc`).

---

## Critical corrections (verified from signed PDFs)

- ✅ **Ammar email:** `a.al-bazi@aston.ac.uk` (hyphenated)
- ✅ **Viktor surname:** **Pekar** (`v.pekar@aston.ac.uk`)
- ✅ **Phone:** UK `+44 7300 469048` / ID `+62 821 2567 2264`
- ✅ **Visa line:** "EU Researcher (Hosting Agreement) visa for European PhDs"

All 8 built apps now use correct fields. (Vienna built PDFs are NOT corrected — Vienna skipped.)

---

## Next 14-day action grid

| Date | Action |
|---|---|
| 2026-05-20 | Send prospective email to Andriushchenko (Tübingen) + Pierri (PoliMi) + Iryna (UKP) |
| 2026-05-24 | Request fresh reference letters from Ammar + Viktor (5-7d lead) |
| 2026-05-29 | Ping Ammar re: Aston decision timeline (task #44) |
| 2026-05-31 | **Submit Copenhagen + UKP** (if Iryna gives green light) |
| 2026-06-01 | **Submit Aarhus** |
| 2026-06-12 | **Submit Chalmers** |
| 2026-06-15 | Submit PoliMi (if call opens + Pierri agrees) |
| 2026-07-30 | **Submit Cambridge (Stage 1 + Stage 2)** |
| Aug-Sep 2026 | Plan US Fall 2027 cycle (task #56) |
