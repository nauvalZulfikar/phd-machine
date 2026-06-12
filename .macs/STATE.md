---
ts: 2026-06-12
turn: "daftarin to each application, buka browser, stop at submit" — resolved via display fork
status:
  done: Established Mac Mini is headless (screencapture fails / no GUI for user). Decided WORKFLOW=Mac-Mini-preps + user-executes-on-own-laptop. Wrote APPLY_FILLSHEET.md (per-portal exact values + PDF upload mapping, 8 live portals + email-only + closed list) and open_apply_tabs.command (deadline-ordered tab opener for user's laptop). Built tools/headed_filler.py (deterministic Playwright filler) — parked; unusable on headless box but kept for future VNC use.
  next: User pulls repo on laptop, runs open_apply_tabs.command, fills per APPLY_FILLSHEET.md. Optionally I pre-draft Saarland(Hahn 6/18) + PoliMi/Pierri inquiry emails.
  blocked: Cannot drive/screenshot a visible browser HERE (no display); account-signup needs email-verify to zulfikar.nauval1998@ (Gmail MCP is a different inbox) + CAPTCHA + fees = inherently human steps.
persisted: [APPLY_FILLSHEET.md, open_apply_tabs.command, tools/headed_filler.py]
---
---
ts: 2026-06-12
turn: "yes" — start building the recon→autofill pipeline, beginning with Chalmers (deadline today)
status:
  done: First real recon run. academicpositions.com aggregator = Cloudflare-blocked (bot dead end). Chalmers native Varbi list readable but NO agentic/monitoring posting in visible current openings (all deadlines Jul-Aug 2026); qwen autonomous loop too flaky to scroll/confirm (failed 5x). Wrote portal_recon/RECON_2026-06-12.md.
  next: HUMAN GATE — open chalmers vacancies page, Ctrl+F "Agentic", confirm open+grab Varbi URL OR mark Chalmers missed. Then proceed Bologna(6/15)/Sapienza(6/17).
  blocked: Cannot confirm Chalmers posting is live → field-map + autofill blocked. academicpositions Cloudflare wall + flaky qwen loop.
persisted: [in-process/chalmers-agentic-monitoring/portal_recon/RECON_2026-06-12.md]
---
# Project state log — appended by MACS after every mutating turn.
# Newest entry at top. Each entry shows: timestamp, user prompt, status, persisted files.
