## Unified Pipeline Orchestrator with PhD Telegram Notifications — 2026-05-17

**Problem:** The PhD/academic discovery pipeline runs as a one-shot Windows Task Scheduler job (`daily_run.bat`) with no Telegram output, making it invisible unless the user manually opens digest files. The job pipeline already has 24/7 Telegram push via `auto/cron.mjs`, but the two pipelines are completely siloed.

**Users:** Nauval (sole user) — monitoring both job applications and PhD opportunities from a single Telegram chat.

**MVP scope:**
- Extend `auto/cron.mjs` to schedule two PhD ticks per day at 07:00 WIB and 19:00 WIB; offsets computed at startup from current time in `Asia/Jakarta`.
- Each PhD tick runs `discover.mjs` (all 4 sources: euraxess, jobs_ac_uk, findaphd, ellis) then `score.mjs`, then pushes top 10 results to Telegram.
- `auto/discover.mjs` and `auto/score.mjs` each emit a stable structured stdout sentinel line: `__SUMMARY__ <json>` (discover) and `__TOPN__ <json>` (score) that cron tick parses to extract push payload without screen-scraping prose.
- Add channel-aware helpers to `auto/notify.mjs`: a `channel` param on `sendTelegram` that prepends `*[JOB]*` or `*[PHD]*` Markdown tag; add `notify.phd.digestReady(date, count)`, `notify.phd.topN(items[])`, and `notify.phd.sourceFailed(source, reason)` exports.
- All existing `notify.*` job helpers unchanged; they implicitly use `[JOB]` tag.
- `daily_run.bat` replaced with a stub that prints a deprecation notice and exits 0.
- Add `ecosystem.config.cjs` with pm2 process `career-ops-cron`, `TZ=Asia/Jakarta`, pointing to `auto/cron.mjs`.
- Add `scripts/deploy.sh`: rsync project to VPS `/root/projects/career-ops/`, `pnpm install --prod`, `pm2 reload ecosystem.config.cjs`.
- Add `auto/test-telegram.mjs` smoke-test (or extend existing) to send both a `[JOB]` and `[PHD]` test message.

**Out of scope:**
- LinkedIn pipeline (decommissioned)
- Mute/quiet hours
- Splitting into separate Telegram chats per channel
- Vitest or other automated test suite
- New academic sources beyond current four

**Acceptance criteria:**
- [ ] `auto/notify.mjs` exports `notify.phd.digestReady`, `notify.phd.topN`, `notify.phd.sourceFailed`; each message body starts with `*[PHD]*`
- [ ] All existing `notify.job.*` / `notify.applySuccess` etc. messages start with `*[JOB]*`
- [ ] `node auto/test-telegram.mjs` delivers one `*[JOB]*` message and one `*[PHD]*` message to Telegram chat
- [ ] `auto/cron.mjs` logs two scheduled PhD ticks on startup (07:00 WIB and 19:00 WIB) with correct offset-from-now in minutes
- [ ] PhD tick in cron: calls discover → score → pushes `notify.phd.topN` with up to 10 entries; cron log shows `✓ tick done: phdDiscover`
- [ ] `auto/discover.mjs` stdout contains line matching `^__SUMMARY__ \{` when run normally; `auto/score.mjs` stdout contains line matching `^__TOPN__ \[`
- [ ] `node auto/discover.mjs --sources findaphd --limit 5` completes without error (findaphd no longer excluded)
- [ ] `daily_run.bat` exits 0 and prints text containing "deprecated"
- [ ] `ecosystem.config.cjs` exists; `env.TZ` equals `"Asia/Jakarta"`; `script` points to `auto/cron.mjs`
- [ ] `scripts/deploy.sh` exists and is executable; running it from dev machine causes `pm2 status career-ops-cron` on VPS to show `online`
- [ ] `pm2 logs career-ops-cron` on VPS shows PhD tick log lines within 24 h of deploy

**Assumptions made:**
- `notify.phd.*` helpers send to the same `TELEGRAM_CHAT_ID` as job notifications — no second bot token needed.
- Existing `notify.*` job helpers (applySuccess, applyFail, etc.) will be wrapped to prepend `*[JOB]*`; callers do not need updating.
- `__SUMMARY__` / `__TOPN__` sentinel lines are appended to existing stdout without removing current human-readable output (backward compatible).
- `scripts/deploy.sh` uses `rsync` + SSH key already configured for `root@72.60.196.21`; no password prompts.
- pm2 + nvm/node22 already installed on VPS at `/root/projects/` per existing Aureonforge VPS layout.
- `profiles/nauval_phd.yaml` already exists and is committed; score.mjs default profile path stays unchanged.
- `pnpm` is available on VPS (or npm is used as fallback — architect to decide).
- PhD tick timeout budget: 15 min (discover scrapes 4 sources + LLM scoring can be slow).
