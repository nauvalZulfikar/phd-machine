# PhD/Postdoc Application Tracker

Last update: 2026-05-16 (post-pivot to general ML/DS/NLP profile)

> 👉 For URGENT this-week deadlines, see [URGENT_TARGETS.md](URGENT_TARGETS.md)

## ✅ Submitted (1)
| Date | University | Position | Type | Portal | Deadline | Followup | Notes |
|---|---|---|---|---|---|---|---|
| 2026-05-15 | **Aston** | PhD p196342 Digital Twin Crowd-Shipping | PhD | SITS | 2026-05-18 | 2026-05-29 | Ref 0656416. Ammar approved. |

## 🎯 Active Targets — 11 Drafted, Ready to Apply

### 🚨 URGENT — Submit This Week (deadline ≤ 7 days)
| Score | Univ | Position | Type | Deadline | Draft path |
|---|---|---|---|---|---|
| 🟡 85 | **Vienna (ELLIS)** | Multiple PhDs in Responsible AI | PhD | **2026-05-20** | `drafts/ellis-ellis-network-multiple-fully-funded-phd-posi/` |
| 🟡 75 | **Cranfield** | Research Fellow Digital Twinning Decarbonising Transport | postdoc | ~2026-05-18 self-imposed | `drafts/jobs_ac_uk-cranfield-university-research-fellow-in-digital-twi/` ✅ PDFs ready |

### 🟡 HIGH — Submit by End of May (deadline ≤ 15 days)
| Score | Univ | Position | Type | Deadline | Draft path |
|---|---|---|---|---|---|
| 🟡 85 | **Copenhagen (ELLIS)** | Postdoc in LLM Factuality Detection | postdoc | 2026-05-31 | `drafts/ellis-ellis-network-postdoc-in-llm-factuality-dete/` |
| 🟡 80 | **TU Darmstadt** | Postdoc UKP Lab ERC InterText | postdoc | 2026-05-31 | `drafts/ellis-ukp-lab-tu-postdoctoral-researcher-for-th/` |
| 🟡 75 | **Copenhagen (ELLIS)** | PhD Fellowship Mechanistic Interp LLM Security | PhD | 2026-05-31 | `drafts/ellis-ellis-network-phd-fellowship-in-mechanistic-/` |

### 🟠 MEDIUM — Submit Early-Mid June
| Score | Univ | Position | Type | Deadline | Draft path |
|---|---|---|---|---|---|
| 🟡 75 | **Aarhus (ELLIS)** | PhD Test-Time Adaptation + Agentic AI | PhD | 2026-06-01 | `drafts/ellis-aarhus-university-phd-position-in-test-time-adap/` |
| 🟡 75 | **Cranfield** | PhD Studentship Agentic AI Supply Chain | PhD | not stated | `drafts/jobs_ac_uk-cranfield-university-phd-studentship-adopting-agent/` |
| 🟡 75 | **Xi'an Jiaotong-Liverpool** | Postdoc Industrial DT | postdoc | not stated | `drafts/jobs_ac_uk-xi-an-jiaotong-liverpool-university-postdoctoral-researcher-in-ind/` |

### 🟠 BACKUP — Apply if Time Allows
| Score | Univ | Position | Type | Deadline | Draft path |
|---|---|---|---|---|---|
| 🟠 70 | **Manchester** | PhD Data-Driven DT Energy | PhD | not stated | `drafts/jobs_ac_uk-the-university-of-manchester-phd-studentship-data-driven-di/` |
| 🟠 70 | **Derby** | AI & DT Systems Engineer KTP | postdoc | not stated | `drafts/jobs_ac_uk-university-of-derby-ai-digital-twin-systems-engine/` |
| 🟠 70 | **Newcastle** | RA Urban Knowledge Modelling | research | not stated | `drafts/jobs_ac_uk-newcastle-university-research-assistant-associate-i/` |

### 🟢 ROLLING — Apply Anytime
| Score | Univ | Position | Type | Status |
|---|---|---|---|---|
| — | **Imperial College London** | EPSRC DTP — Computing PhD | PhD | needs proposal + supervisor outreach |
| — | **King's College London** | Informatics studentships Oct 2026 | PhD | needs proposal |
| — | **MCML LMU Munich** | ML PhD positions | PhD | Master cert by Jul 1 |

---

## 📋 Weekend Batch-Apply Workflow

For each target (~45-60 min):

1. **Read draft folder** → `apply_summary.md`, note portal URL + deadline
2. **Inspect portal** (10-15 min):
   ```bash
   node auto/inspect.mjs --opp-id <slug> --url <portal-url>
   ```
3. **Splice tailored sections** into base RS/PS (5-10 min):
   - Base RS: `phd_aston_prep/application/research_statement.md`
   - Replace "Why Aston" section with `rs_why_this_opp.md`
   - Replace PS opening with `ps_opening_hook.md`
4. **Regenerate PDF** (1 min): `python md_to_pdf.py`
5. **Fill portal using REPORT.md as guide** (30-45 min)
6. **Submit + update STATUS.md** (1 min)

---

## 📊 Pipeline Health

| Metric | Value |
|---|---|
| Total opportunities discovered | 101 |
| Strong-fit (≥80) | 3 |
| Good-fit (≥70) | 12 |
| Mid-fit (≥60) | 18 |
| ELLIS positions captured | 21 |
| Drafts ready | 11 |
| Submitted | 1 (Aston) |
| Urgent ≤7 day | 2 (Vienna, Cranfield) |
| Urgent ≤15 day | 5 |

---

## 🔄 Followup Reminders

- **Aston** — auto-followup due **2026-05-29** if no contact received
- **Cranfield** (when submitted) — followup +2 weeks
- **ELLIS Vienna** (after 2026-05-20 submit) — followup +3 weeks (early June)
- **All others** — followup +2 weeks after submission

---

## 🚀 Daily Cadence (target — after Task Scheduler setup)

| Time | Action | Effort |
|---|---|---|
| 07:00 | (automated) discover + score runs | 0 min |
| 08:00 | Read `digests/scored-YYYY-MM-DD.md` | 5 min |
| 09:00 | Tailor new ≥75 opps: `node auto/tailor.mjs --profile profiles/nauval_ml_phd.yaml --min-score 75` | 5 min |
| Afternoon | Inspect + fill 1-2 portals | 90 min |
| Evening | Update STATUS.md | 5 min |

---

## 🗓️ Plan Ahead — Oct-Dec 2026 (For Fall 2027 Entry)

Premier UK CDT programmes — most closed for 2026-27, opening for 2027-28 in late 2026:

| Programme | Opens | Apply For |
|---|---|---|
| Edinburgh CDT in ML Systems | Oct 2026 | Sep 2027 entry |
| Edinburgh UKRI CDT Responsible NLP | Late 2026 | Sep 2027 entry |
| Oxford StatML CDT | Late 2026 | 2027-28 entry |
| Oxford Healthcare DS CDT | Late 2026 | 2027-28 entry |
| ELLIS Central Call | Oct 31, 2026 | Sep 2027 entry |

Set calendar reminders for **2026-09-15**: start drafting proposals + reach out to potential supervisors.
