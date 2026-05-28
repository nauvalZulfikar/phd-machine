# auto/ Pipeline — Build Status

## What was built (2026-05-15)

Universal job-application pipeline in `auto/`:

```
auto/
├── README.md               — architecture & usage
├── apply.mjs               — CLI: `node auto/apply.mjs <url>` or `--batch <list.json>`
├── pipeline.mjs            — orchestrator (detect→tailor→render→fill→submit)
├── ai/
│   ├── client.mjs          — Claude API + Gemini fallback + baseline mode
│   └── prompts.mjs         — scoring / CV tailor / CL / Q&A prompts
├── ats/
│   ├── base.mjs            — common interface + Playwright helpers
│   ├── detect.mjs          — URL → adapter routing
│   ├── ashby.mjs           — Ashby adapter (form inspect, fill, submit)
│   ├── greenhouse.mjs      — Greenhouse adapter
│   └── lever.mjs           — Lever adapter
├── cv/
│   ├── render.mjs          — profile + tailoring directives → HTML
│   ├── cv-template.html    — placeholder template
│   └── cl-template.html    — cover letter template
└── qa/
    └── match.mjs           — Q label → profile field / template / LLM answer
```

## E2E verified

- **Synthesia (Ashby)** — minimal form (8 fields): scored, tailored, filled, submitted → confirmation email received ✅
- **Lovable (Ashby)** — complex form (15 fields): scored, tailored, filled. 12/15 fields answered automatically; 3 still need selector polish.

## Working in baseline mode (no API key)

- ATS detect ✅
- Form inspect (Ashby/Greenhouse/Lever) ✅
- Template-based CV+CL rendering ✅
- PDF generation ✅
- Heuristic Q&A matching from `profile.qa_hints` ✅
- Playwright form fill (text, email, tel, url, file, select, checkbox, radio-group, button-toggle, typeahead) ✅
- Screenshot + confirmation capture ✅

## Upgrade path (set API key)

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # OR
export GEMINI_API_KEY=AIza...

node auto/apply.mjs <url>             # auto-uses AI for scoring + tailoring + free-text Qs
```

When LLM is enabled:
- CV directives generated per-job (better than static template)
- Cover letter custom per company + JD
- Free-text Qs ("what excites you about...?") answered specifically

## Source adapters (sourcing-only, no submit)

These extend coverage beyond Ashby/GH/Lever — but **DO NOT** submit applications. They only feed the pipeline.

### Workday (`auto/ats/workday.mjs`)
- Public JSON API: `POST https://<tenant>.<wd1|3|5>.myworkdayjobs.com/wday/cxs/<tenant>/<site>/jobs`
- Requires session cookies (visit landing page first)
- Reality check 2026-05-15: Grab is in ATS migration blackout (24 Nov–11 Dec), 0 jobs. Most SEA Workday tenants returned 404 on common slugs.
- **Build status:** fetch-only (no form-fill — Workday's 6-step wizard + Cloudflare anti-bot is multi-day effort)

### LinkedIn (`auto/sources/linkedin.mjs` + `auto/scan-linkedin.mjs`)
- Guest job search HTML endpoint, no login required
- Pagination via `?start=N`, page size 25
- Filters: work type (remote/hybrid/onsite), experience level, time posted
- **Coverage breakthrough for Indonesia:** 78 jobs scanned, 40 Indonesia-based on first pass (Kredivo, Krom, Agoda Bali, tiket.com, Bibit.id, Speechify, BJAK, Cove, Flip Indo, etc.)
- **Apply flow:** manual via LinkedIn — career-ops cannot auto-submit. Jobflow Chrome extension handles LinkedIn Easy Apply if applicable.
- Run: `node auto/scan-linkedin.mjs` → writes `tmp/linkedin-jobs.json` + `data/pipeline-linkedin.md`

## 24/7 mode

Run the system continuously — scheduler + dashboard server stay up, scan portals + LinkedIn periodically, regenerate dashboard on a loop.

### Quick start (Windows, no extra deps)
```cmd
start.bat
```
Spawns 2 background windows:
- `node auto/serve.mjs` → http://localhost:4280
- `node auto/cron.mjs`  → scheduled scans

Stop: `stop.bat`

### PM2 mode (recommended for true production)
```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 ls
```
Auto-start on Windows boot:
```bash
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

### Cron schedule (override via env, milliseconds)
| Tick | Default | Env var | Action |
|---|---|---|---|
| dashboard | 60 min | `CRON_DASHBOARD` | regenerate dashboard.html |
| portals   | 360 min (6h) | `CRON_PORTALS` | scan Ashby/Greenhouse/Lever via API |
| feed      | 1440 min (24h) | `CRON_FEED` | compile new-jobs feed |
| autoApply | 60 min | `CRON_AUTOAPPLY` | hourly auto-apply orchestrator (capped 50/day) |

### Auto-apply orchestrator (`auto/auto-apply.mjs`)

Hourly runs, picks top candidates, submits with rate-limit + anti-spam guardrails.

| Config | Default | Env override |
|---|---|---|
| Daily cap (across all platforms) | 50 | `AUTO_APPLY_DAILY_CAP` |
| Score threshold (title+location heuristic) | 20 | `AUTO_APPLY_THRESHOLD` |
| Rate limit between submits | 5 min | `AUTO_APPLY_RATE_MS` (ms) |
| Apps per tick (cron call) | 3 | `AUTO_APPLY_PER_TICK` |
| Per-company cooldown | 7 days | `AUTO_APPLY_COMPANY_COOLDOWN` |
| Consecutive-fail shutdown | 3 | `AUTO_APPLY_FAIL_SHUTDOWN` |
| Per-tick per-company cap | 1 (hardcoded) | — |

State persisted in `data/.auto-apply-state.json` (daily counter resets at UTC 00:00).

Round-robin across Ashby / Greenhouse / Lever for fingerprint diversity.

Flags:
- `--dry` — show picks, no submit
- `--once` — attempt 1 application then exit
- `--status` — print state JSON
- `--reset` — reset daily counters

### Telegram notifier (`auto/notify.mjs`)

Setup: env vars `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`. Without them, falls back to console log.

Events: apply success / apply fail / daily cap reached / shutdown.

All values in milliseconds when overriding. Example fast smoke test:
```bash
CRON_DASHBOARD=20000 CRON_FEED=10000 node auto/cron.mjs
```

### Files written by 24/7 mode
- `tmp/cron.log` — structured tick log (rotated at 5 MB)
- `tmp/serve.log` — dashboard server stdout
- `data/.seen-urls.txt` — persistent "ever seen" URL set (used for feed dedup)
- `data/new-jobs-feed.md` — daily "what's new" digest
- `dashboard.html` — regenerated on every dashboard tick

## Unified orchestrator (2026-05-17)

Single cron.mjs now coordinates both job and PhD pipelines with shared Telegram notifier:

- **Job pipeline:** Ashby/Greenhouse/Lever portal scanning + hourly auto-apply (rate-limited, max 50/day)
- **PhD pipeline:** EURAXESS + jobs.ac.uk discovery, AI scoring, Telegram push at 07:00 & 19:00 WIB
- **Tagging:** All Telegram messages prefixed with `*[JOB]*` or `*[PHD]*` for quick filtering
- **Timezone:** `TZ=Asia/Jakarta` (set in `ecosystem.config.cjs` for pm2 deploy)
- **State:** Separate persistent state files (`auto/.phd-state.json`, `auto/.job-state.json`)
- **Deprecation:** `daily_run.bat` (Windows Task Scheduler) no longer active; use pm2 instead

Resolves: previous standalone PhD discover process; Telegram was job-only before.

## Known limitations (next iteration)

| Bug | Where | Fix path |
|---|---|---|
| Resume file input not always filled on Ashby | `ats/ashby.mjs` inspect | Detect file inputs via `accept=*.pdf` regardless of visibility |
| Location typeahead not always firing | `ats/ashby.mjs` `typeAheadSelect` | Wait for autocomplete listbox to render; click on actual option element |
| Visa button-toggle not always detected as such on certain Ashby variants | `ats/ashby.mjs` inspect | Add second scan: find `<button>Yes</button><button>No</button>` siblings even without question-title class |
| Greenhouse forms with React-rendered dropdowns | `ats/greenhouse.mjs` | Use `aria-haspopup`, `[role="listbox"]` to detect + click options |
| LLM-mode CV directives validation | `cv/render.mjs` | Schema-validate LLM JSON, fall back to baseline on malformed |

## CLI usage

```bash
# Dry run (default): fill, screenshot, stop before submit
node auto/apply.mjs https://jobs.ashbyhq.com/company/uuid

# Real submit (asks confirmation by opening browser visibly)
node auto/apply.mjs https://jobs.ashbyhq.com/company/uuid --submit

# Batch from shortlist (tmp/batch.json from heuristic ranker)
node auto/apply.mjs --batch tmp/batch.json

# Visible browser (useful for debugging)
node auto/apply.mjs <url> --headed
```

## Output per run

`tmp/runs/<date>/<company>-<role>/`:
- `cv.html`, `cv.pdf` — tailored CV
- `cl.html`, `cl.pdf` — cover letter
- `form-schema.json` — detected form fields
- `answers.json` — resolved answers per field
- `form-filled.png` — pre-submit screenshot
- `confirmation.png`, `confirmation.txt` — post-submit (if --submit)
- `summary.json` — run metadata
