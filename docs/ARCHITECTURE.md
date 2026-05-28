# Architecture

## System Overview

```
                    ┌─────────────────────────────────┐
                    │         AI Coding CLI Agent      │
                    │   (reads AGENTS.md + modes/*.md) │
                    └──────────┬──────────────────────┘
                               │
            ┌──────────────────┼──────────────────────┐
            │                  │                       │
     ┌──────▼──────┐   ┌──────▼──────┐   ┌───────────▼────────┐
     │ Single Eval  │   │ Portal Scan │   │   Batch Process    │
     │ (auto-pipe)  │   │  (scan.md)  │   │   (batch-runner)   │
     └──────┬──────┘   └──────┬──────┘   └───────────┬────────┘
            │                  │                       │
            │           ┌──────▼──────┐          ┌────▼─────┐
            │           │ pipeline.md │          │ N workers│
            │           │ (URL inbox) │          │ (headless)
            │           └─────────────┘          └────┬─────┘
            │                                          │
     ┌──────▼──────────────────────────────────────────▼──────┐
     │                    Output Pipeline                      │
     │  ┌──────────┐  ┌────────────┐  ┌───────────────────┐  │
     │  │ Report.md│  │  PDF (HTML  │  │ Tracker TSV       │  │
     │  │ (A-F eval)│  │  → Puppeteer)│  │ (merge-tracker)  │  │
     │  └──────────┘  └────────────┘  └───────────────────┘  │
     └────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  data/applications.md │
                    │  (canonical tracker)  │
                    └──────────────────────┘
```

## Evaluation Flow (Single Offer)

1. **Input**: User pastes JD text or URL
2. **Extract**: Playwright/WebFetch extracts JD from URL
3. **Classify**: Detect archetype (1 of 6 types)
4. **Evaluate**: 6 blocks (A-F):
   - A: Role summary
   - B: CV match (gaps + mitigation)
   - C: Level strategy
   - D: Comp research (WebSearch)
   - E: CV personalization plan
   - F: Interview prep (STAR stories)
5. **Score**: Weighted average across 10 dimensions (1-5)
6. **Report**: Save as `reports/{num}-{company}-{date}.md`
7. **PDF**: Generate ATS-optimized CV (`generate-pdf.mjs`)
8. **Track**: Write TSV to `batch/tracker-additions/`, auto-merged

## Batch Processing

The batch system processes multiple offers in parallel:

```
batch-input.tsv    →  batch-runner.sh  →  N × headless CLI workers
(id, url, source)     (orchestrator)       (self-contained prompt)
                           │
                    batch-state.tsv
                    (tracks progress)
```

Each worker is a headless AI CLI instance — the bundled `batch-runner.sh` invokes `claude -p`, but the architecture supports any CLI's headless mode (see the Headless / Batch Mode table in `AGENTS.md` for the correct command per CLI). Workers produce:
- Report .md
- PDF
- Tracker TSV line

The orchestrator manages parallelism, state, retries, and resume.

## Data Flow

```
cv.md                    →  Evaluation context
article-digest.md        →  Proof points for matching
config/profile.yml       →  Candidate identity
portals.yml              →  Scanner configuration
templates/states.yml     →  Canonical status values
templates/cv-template.html → PDF generation template
```

## File Naming Conventions

- Reports: `{###}-{company-slug}-{YYYY-MM-DD}.md` (3-digit zero-padded)
- PDFs: `cv-candidate-{company-slug}-{YYYY-MM-DD}.pdf`
- Tracker TSVs: `batch/tracker-additions/{id}.tsv`

## Pipeline Integrity

Scripts maintain data consistency:

| Script | Purpose |
|--------|---------|
| `merge-tracker.mjs` | Merges batch TSV additions into applications.md |
| `verify-pipeline.mjs` | Health check: statuses, duplicates, links |
| `dedup-tracker.mjs` | Removes duplicate entries by company+role |
| `normalize-statuses.mjs` | Maps status aliases to canonical values |
| `cv-sync-check.mjs` | Validates setup consistency |

## Dashboard TUI

The `dashboard/` directory contains a standalone Go TUI application that visualizes the pipeline:

- Filter tabs: All, Evaluada, Aplicado, Entrevista, Top >=4, No Aplicar
- Sort modes: Score, Date, Company, Status
- Grouped/flat view
- Lazy-loaded report previews
- Inline status picker

---

## Unified Pipeline Orchestrator with PhD Telegram Notifications — 2026-05-17

**Stack additions:** none — uses existing `dotenv`, `playwright`, `js-yaml`; deploy uses `npm` (not pnpm, package-lock.json is canonical).

**Data model:** no new tables/files; new sentinel lines are stdout-only (no disk writes beyond existing digest files).

---

### 1. File touchpoints

| File | Status | What changes |
|---|---|---|
| `auto/notify.mjs` | MODIFY | Add `channel` param to `sendTelegram`; wrap all existing `notify.*` helpers to prepend `*[JOB]*`; add `notify.phd.*` group |
| `auto/cron.mjs` | MODIFY | Add `tickPhd()` function; schedule two WIB-aligned `setTimeout` + `setInterval(12h)` ticks at startup; add `CRON_PHD` env override; log PhD tick schedule lines |
| `auto/discover.mjs` | MODIFY | Append `__SUMMARY__ <json>` sentinel to stdout after existing human output in `main()`; add `findaphd` to default `--sources` list |
| `auto/score.mjs` | MODIFY | Append `__TOPN__ <json>` sentinel to stdout after existing Top-N preview in `main()` |
| `ecosystem.config.cjs` | MODIFY | Add `TZ: 'Asia/Jakarta'` to `career-ops-cron` env block (entry already exists, no new process needed) |
| `auto/test-telegram.mjs` | CREATE | Smoke test: sends one `*[JOB]*` ping and one `*[PHD]*` ping; exits 0 |
| `scripts/deploy.sh` | CREATE | rsync + npm install --omit=dev + pm2 reload |
| `daily_run.bat` | MODIFY | Replace body with deprecation stub (exits 0) |

---

### 2. Channel-tagging in notify.mjs

- `sendTelegram(text, opts = {})` gains a `channel` parameter with default `'JOB'`.
- Prepend is done **inside `sendTelegram` itself**, not in each helper. Rationale: single enforcement point; callers (including future ones) get tagging for free.
- Prefix format: `` `*[${channel}]* ${text}` `` — one space separator, then original text. Markdown bold brackets render as `[JOB]` in Telegram.
- All existing `notify.*` helpers call `sendTelegram(text)` with no channel arg — they implicitly get `*[JOB]*` prefix. No caller changes needed.
- New `notify.phd` group calls `sendTelegram(text, { channel: 'PHD' })`.

```
notify.phd.digestReady(date, count)    → "*[PHD]* 🎓 *PhD Digest — {date}*\n{count} novel opportunities found."
notify.phd.topN(items[])              → "*[PHD]* 🏆 *Top PhD Picks*\n1. [title](url) · score\n..."  (up to 10)
notify.phd.sourceFailed(source, reason) → "*[PHD]* ⚠️ Source `{source}` failed: {reason}"
```

---

### 3. Cron schedule for PhD ticks — Decision: option (a), two staggered setTimeout + setInterval(12h)

- At startup, compute milliseconds until next 07:00 WIB and next 19:00 WIB from `new Date()` (TZ is `Asia/Jakarta` via pm2 env).
- Fire first tick via `setTimeout(fn, msUntilFirst07)` → then `setInterval(fn, 24 * HOUR)` per anchor, two anchors at 7h and 19h give 12h effective spacing.
- Same pattern for 19:00 tick, offset by 12 h from 07:00 anchor.
- **Why not option (b) (hourly poll):** option (a) is exact, no drift, no missed-hour edge cases. Option (b) has a ±1 h window if cron ticks at :59 vs :01.
- **DST:** Indonesia does not observe DST — `Asia/Jakarta` is UTC+7 year-round. No DST risk.
- **VPS reboot mid-day:** If pm2 restarts after 07:00 but before 19:00, the 07:00 slot is missed for that day. Acceptable — pm2 `autorestart: true` limits this to crash scenarios. Adding `runImmediately: true` on first boot would double-fire; omit it.
- **Laptop sleep:** cron.mjs runs on VPS only under pm2; laptop is dev-only. No sleep issue.
- **Env override:** `CRON_PHD_HOUR1=7` and `CRON_PHD_HOUR2=19` (integers) allow shifting fire times in tests without touching code.

---

### 4. Stdout sentinel format

**discover.mjs** — appended as last line of `main()` after all existing console output:
```
__SUMMARY__ {"novel":12,"total":47,"bySource":{"euraxess":5,"jobs_ac_uk":4,"findaphd":2,"ellis":1}}
```

**score.mjs** — appended as last line of `main()` after Top-N preview:
```
__TOPN__ [{"title":"...","score":88,"verdict":"strong-fit","url":"https://...","source":"euraxess"}, ...]
```
Array contains up to 10 items (matches `--top` default).

**Parser in cron.mjs tickPhd():**
```js
const summaryMatch = out.match(/^__SUMMARY__ (.+)$/m);
const topNMatch    = out.match(/^__TOPN__ (.+)$/m);
```
Both use `/m` multiline flag so `^` matches start of any line. JSON.parse on captured group 1. If either regex fails (e.g. discover produced 0 novel items), tick logs a warning but does not throw — Telegram push is skipped gracefully.

---

### 5. PhD tick flow — Decision: ONE tick per fire

`tickPhd()` in cron.mjs runs sequentially:
1. `runNode(['auto/discover.mjs', '--sources', 'euraxess,jobs_ac_uk,findaphd,ellis', '--limit', '80', '--profile', 'profiles/nauval_ml_phd.yaml'], 15 * 60_000)` — parse `__SUMMARY__`
2. If discover exit code 0: `runNode(['auto/score.mjs', '--profile', 'profiles/nauval_ml_phd.yaml', '--top', '10'], 15 * 60_000)` — parse `__TOPN__`
3. Push `notify.phd.digestReady(date, novel)` then `notify.phd.topN(items)` in one tick.
4. Any source-level failure inside discover.mjs is already caught internally and reported via `notify.phd.sourceFailed` from within tickPhd using stderr lines (grep for `✗ <source>:`).

Rationale: atomic flow, single log entry, single Telegram digest per fire. Two-tick approach adds scheduling complexity for negligible benefit.

---

### 6. Timeout

- Each `runNode()` call inside `tickPhd` gets `15 * 60_000` ms (15 min).
- Total worst case: 30 min (discover 15 min + score 15 min). Well within 12 h tick gap.
- `runNode` already sends `SIGTERM` on timeout — no new mechanism needed.
- `discover.mjs` note: `score.mjs --profile` argument is not currently supported by score.mjs's `parseArgs` (it uses `--profile` already — confirmed in source). Pass as-is.

---

### 7. ecosystem.config.cjs changes

`career-ops-cron` entry already exists. Only modification: add `TZ: 'Asia/Jakarta'` to its `env` block. No new pm2 process. The `career-ops-serve` entry is unchanged.

```js
env: {
  NODE_ENV: 'production',
  TZ: 'Asia/Jakarta',
  // existing key placeholders remain as comments
},
```

---

### 8. scripts/deploy.sh — step outline

1. `rsync -avz --exclude='.git' --exclude='node_modules' --exclude='tmp/' --exclude='data/' --exclude='logs/' -e ssh ./ root@72.60.196.21:/root/projects/career-ops/`
2. `ssh root@72.60.196.21 "cd /root/projects/career-ops && npm install --omit=dev"` — uses npm (package-lock.json present; no pnpm on VPS assumed).
3. `ssh root@72.60.196.21 "pm2 reload ecosystem.config.cjs --update-env"`
4. Smoke: `ssh root@72.60.196.21 "pm2 describe career-ops-cron | grep -E 'status|pid'"` — prints status; script exits non-zero if grep finds `stopped|errored`.
5. Note: `data/` and `logs/` excluded from rsync to avoid overwriting VPS-local state. `tmp/` excluded (pm2 log files live there).

---

### 9. Race condition: discover.mjs vs auto-apply.mjs (Playwright)

- `auto/discover.mjs` uses `auto/sources/_browser.mjs` (shared singleton for academic scrapers).
- `auto/auto-apply.mjs` uses its own Playwright instance.
- PhD tick fires at 07:00 and 19:00 WIB. `autoApply` ticks every 1 h. Overlap is possible.
- Decision: **accept two Chromium instances**. Rationale: discover.mjs calls `shutdownBrowser()` between each source already (line 168 in source), so peak concurrency is one browser per pipeline. VPS `max_memory_restart: '500M'` on cron process provides a safety valve. Sibedas + POS on same VPS are lightweight (no Playwright). A lock file adds complexity and a new failure mode (stale lock on crash).
- Mitigation: `tickPhd` runs discover as a child process; if VPS RAM is tight during a PhD tick, the cron process itself may hit `max_memory_restart` and pm2 will restart it. Log will show this. No data corruption risk.

---

### 10. daily_run.bat deprecation stub

```bat
@echo off
echo [DEPRECATED] daily_run.bat is no longer active.
echo PhD discovery now runs via career-ops-cron (pm2) at 07:00 and 19:00 WIB.
echo See: pm2 logs career-ops-cron
exit /b 0
```

Two informational echo lines + `exit /b 0`. Windows Task Scheduler will record exit code 0 (success). No functional code remains.

---

### 11. TZ handling

- `TZ=Asia/Jakarta` set in `ecosystem.config.cjs` env for `career-ops-cron`. Node.js respects `TZ` env var for `new Date()`, `Date.getHours()`, `toLocaleString()`, etc. on Linux/VPS.
- `cron.mjs` already uses `new Date().toISOString()` for log timestamps — those remain UTC (ISO format is always UTC). That is correct and unchanged.
- The PhD scheduler computes WIB offsets using `new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false })` to get current WIB hour reliably regardless of host TZ — this avoids relying on `TZ` env being set correctly in dev environments where the bat file was used.
- On Windows dev machine (where TZ env is not set), `test-telegram.mjs` does not schedule anything — it only sends test messages, so TZ is irrelevant there.

---

**Key decisions summary:**

- `sendTelegram` is the single prepend point for channel tags — zero caller changes for existing job helpers.
- Two `setTimeout + setInterval(12h)` anchored to 07:00/19:00 WIB — exact timing, no DST risk (Jakarta is UTC+7 fixed).
- One atomic PhD tick (discover → score → push) — simpler error boundary, single Telegram digest.
- `ecosystem.config.cjs` modified in-place (no new pm2 process) — `career-ops-cron` entry already exists.
- `npm` used for VPS install (package-lock.json is present, no pnpm assumption).
- Two Chromium instances accepted over lock-file complexity — `max_memory_restart: 500M` is the safety valve.

**Open questions:**
- `discover.mjs` currently defaults `--sources` to `['euraxess', 'jobs_ac_uk', 'ellis']` (findaphd excluded). The tickPhd call will pass `--sources euraxess,jobs_ac_uk,findaphd,ellis` explicitly — this sidesteps the default but the default in parseArgs should also be updated to include findaphd for CLI parity (acceptance criterion: `node auto/discover.mjs --sources findaphd --limit 5` works, which it already does since findaphd is implemented; the question is whether to also change the default array).
- VPS RAM headroom: unknown exact free RAM on 72.60.196.21 during PhD tick overlap window. Monitor `pm2 logs career-ops-cron` for `max_memory_restart` events in first 48 h post-deploy.
