#!/usr/bin/env node
/**
 * Autonomous hourly status report → Telegram.
 *
 * Runs from cron every hour. Reads:
 *   - tmp/cron.log (recent activity)
 *   - data/.auto-apply-state.json (today's counters)
 *   - data/pipeline.md (pipeline size)
 *   - http://localhost:4280/api/status (recent submissions)
 *
 * Then formats compact Telegram message and sends via notify.mjs.
 *
 * No Claude session required. Triggered by auto/cron.mjs hourlyReport tick.
 *
 * Flags:
 *   --console  print to stdout instead of Telegram (debug)
 */
import 'dotenv/config';
import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { sendTelegram } from './notify.mjs';

const ROOT = process.cwd();
const CRON_LOG = resolve(ROOT, 'tmp/cron.log');
const STATE_FILE = resolve(ROOT, 'data/.auto-apply-state.json');
const PIPELINE_FILE = resolve(ROOT, 'data/pipeline.md');

const FLAGS = { console: process.argv.includes('--console') };

function readMaybe(p) { try { return readFileSync(p, 'utf-8'); } catch { return ''; } }
function readJSON(p) { try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; } }

function fmtClock(d) {
  return d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
}
function fmtMin(ms) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── 1. Cron health ──────────────────────────────────────────────
function cronHealth() {
  if (!existsSync(CRON_LOG)) return { alive: false, reason: 'no cron.log' };
  const log = readMaybe(CRON_LOG);
  const startMatch = [...log.matchAll(/^\[([^\]]+)\] ━━━ career-ops cron started/gm)].pop();
  if (!startMatch) return { alive: false, reason: 'no start marker' };
  const startUTC = new Date(startMatch[1] + 'Z');
  const lastTickMatch = [...log.matchAll(/^\[([^\]]+)\] [▶✓✗]/gm)].pop();
  const lastTickUTC = lastTickMatch ? new Date(lastTickMatch[1] + 'Z') : startUTC;
  const now = new Date();
  const sinceLast = now - lastTickUTC;
  const uptime = now - startUTC;
  // Healthy if last tick within 65 min (allowing 5-min slack on hourly schedule)
  const stale = sinceLast > 65 * 60 * 1000;
  return {
    alive: !stale,
    uptime,
    sinceLast,
    startUTC,
    lastTickUTC,
  };
}

// ─── 2. Submissions in last hour (from log) ──────────────────────
function submissionsThisHour() {
  const log = readMaybe(CRON_LOG);
  const cutoff = new Date(Date.now() - 65 * 60 * 1000);
  const events = [];
  for (const m of log.matchAll(/^\[([^\]]+)\]\s+auto-apply:\s+\+(\d+)\s+this tick/gm)) {
    const t = new Date(m[1] + 'Z');
    if (t >= cutoff) events.push({ t, count: Number(m[2]) });
  }
  // Sum
  return events.reduce((s, e) => s + e.count, 0);
}

// ─── 3. Today's submissions (from dashboard API or status.yml) ───
async function todaysSubmissions() {
  try {
    const res = await fetch('http://localhost:4280/api/status', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const arr = await res.json();
    const today = new Date().toISOString().slice(0, 10);
    return arr.filter(r => r.date === today && r.stage === 'submitted');
  } catch { return []; }
}

// ─── 4. Pipeline size ────────────────────────────────────────────
function pipelineSize() {
  const m = readMaybe(PIPELINE_FILE).match(/^- \[ \]/gm);
  return m ? m.length : 0;
}

// ─── 4b. Fresh-job count from scan-history ───────────────────────
function freshJobCounts() {
  const SCAN = resolve(ROOT, 'data/scan-history.tsv');
  if (!existsSync(SCAN)) return { lt1h: 0, lt6h: 0, lt24h: 0 };
  const lines = readMaybe(SCAN).split('\n').slice(1);
  const now = Date.now();
  let lt1h = 0, lt6h = 0, lt24h = 0;
  for (const line of lines) {
    const cols = line.split('\t');
    if (cols.length < 6) continue;
    if (cols[5] !== 'added') continue;
    const ts = new Date(cols[1]).getTime();
    if (!ts) continue;
    const ageH = (now - ts) / 3600000;
    if (ageH <= 1)  lt1h++;
    if (ageH <= 6)  lt6h++;
    if (ageH <= 24) lt24h++;
  }
  return { lt1h, lt6h, lt24h };
}

// ─── 5. Last cron-log errors (last 24h) ──────────────────────────
function recentErrors() {
  const log = readMaybe(CRON_LOG);
  const cutoff = new Date(Date.now() - 65 * 60 * 1000);
  const errors = [];
  for (const m of log.matchAll(/^\[([^\]]+)\]\s+✗\s+tick failed:\s+(.+)$/gm)) {
    const t = new Date(m[1] + 'Z');
    if (t >= cutoff) errors.push({ t, msg: m[2] });
  }
  return errors;
}

// ─── Build + send report ─────────────────────────────────────────
async function main() {
  const now = new Date();
  const health = cronHealth();
  const state = readJSON(STATE_FILE) || { dailyCount: 0, dailyFails: 0, consecutiveFails: 0 };
  const subsThisHour = submissionsThisHour();
  const todaysSubs = await todaysSubmissions();
  const pipeSize = pipelineSize();
  const errors = recentErrors();

  const lines = [`📊 *Career-ops* — ${fmtClock(now)} WIB`];

  if (!health.alive) {
    lines.push('');
    lines.push('🚨 *CRON DEAD or STALE*');
    if (health.reason) lines.push(`Reason: ${health.reason}`);
    if (health.sinceLast) lines.push(`Last tick: ${fmtMin(health.sinceLast)} ago`);
    lines.push('Run `start.bat` to restart.');
  } else {
    lines.push(`Uptime: ${fmtMin(health.uptime)} · last tick ${fmtMin(health.sinceLast)} ago`);
  }

  lines.push('');
  lines.push(`🎯 Today: *${state.dailyCount}/50* submitted · ${state.dailyFails} fail${state.dailyFails === 1 ? '' : 's'}`);
  if (state.consecutiveFails >= 3) {
    lines.push(`⚠️ *Auto-shutdown active* (${state.consecutiveFails} consecutive fails) — run \`node auto/auto-apply.mjs --reset\``);
  }
  lines.push(`📥 +${subsThisHour} this hour`);

  if (todaysSubs.length > 0) {
    lines.push('');
    lines.push('✅ *Today\'s submitted*:');
    for (const r of todaysSubs.slice(0, 5)) {
      lines.push(`• ${r.slug}`);
    }
    if (todaysSubs.length > 5) lines.push(`…and ${todaysSubs.length - 5} more`);
  }

  if (errors.length > 0) {
    lines.push('');
    lines.push('⚠️ *Errors this hour*:');
    for (const e of errors.slice(0, 3)) lines.push(`• ${e.msg.slice(0, 100)}`);
  }

  const fresh = freshJobCounts();
  lines.push('');
  lines.push(`📦 Pipeline: ${pipeSize} jobs · 🔥 ${fresh.lt1h} fresh (≤1h) · ${fresh.lt6h} ≤6h · ${fresh.lt24h} ≤24h`);

  // Next-update line — runs hourly, so next fire ≈ now + 60 min.
  const next = new Date(Date.now() + 60 * 60 * 1000);
  lines.push(`🔔 Next report: ~${fmtClock(next)} WIB`);

  const text = lines.join('\n');

  if (FLAGS.console) {
    console.log(text);
    return;
  }

  const res = await sendTelegram(text);
  if (res.ok) {
    console.log(`Sent hourly report (${text.length} chars)`);
  } else {
    console.log(`Failed to send: ${JSON.stringify(res)}`);
    console.log('--- report content ---');
    console.log(text);
  }
}

main().catch(e => {
  console.error('hourly-report error:', e.message);
  process.exit(1);
});
