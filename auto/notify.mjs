/**
 * Telegram notifier for auto-apply events (cron-triggered).
 *
 * Setup (one-time, ~3 min):
 *   1. Talk to @BotFather on Telegram → /newbot → save the token
 *   2. Send 1 message to your new bot
 *   3. Get your chat_id:
 *        curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -oE '"chat":{"id":[0-9-]+' | head -1
 *   4. Export env vars (in shell or PM2 ecosystem):
 *        TELEGRAM_BOT_TOKEN=...
 *        TELEGRAM_CHAT_ID=...
 *
 * Without env vars, sendTelegram() is a no-op (logs to console).
 *
 * Usage:
 *   import { notify } from './notify.mjs';
 *   await notify.applySuccess('Synthesia', 'Commercial DS', runDir);
 */

import 'dotenv/config';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export async function sendTelegram(text, opts = {}) {
  if (!TOKEN || !CHAT_ID) {
    console.log(`[notify·stub] ${text}`);
    return { ok: false, reason: 'no-token' };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: opts.parseMode || 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.log(`[notify·err] ${res.status}: ${errText.slice(0, 200)}`);
      return { ok: false, status: res.status };
    }
    return { ok: true };
  } catch (e) {
    console.log(`[notify·err] ${e.message}`);
    return { ok: false, error: e.message };
  }
}

// Formatted job-apply messages
export const notify = {
  applySuccess: (company, title, runDir) => sendTelegram(
    `✅ *Applied*\n*${company}* — ${title}\n\`${runDir.split(/[\\/]/).pop()}\``
  ),
  applyFail: (company, title, reason) => sendTelegram(
    `⚠️ *Apply failed*\n*${company}* — ${title}\nReason: ${reason}`
  ),
  capReached: (count) => sendTelegram(
    `🛑 *Daily cap reached*\n${count} apps submitted today. Auto-apply paused until tomorrow.`
  ),
  shutdown: (reason) => sendTelegram(
    `🚨 *Auto-apply shutdown*\n${reason}\nManual intervention needed.`
  ),
  dailySummary: (sent, failed, top) => sendTelegram(
    `📊 *Daily summary*\nSent: ${sent} · Failed: ${failed}\n\nTop applies:\n${top.map(t => `• ${t}`).join('\n')}`
  ),
};
