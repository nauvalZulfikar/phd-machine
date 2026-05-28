#!/usr/bin/env node
/**
 * Verify Telegram setup. Run after filling TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in .env:
 *   node auto/test-telegram.mjs
 */
import 'dotenv/config';
import { notify } from './notify.mjs';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

console.log('─── Telegram setup check ───');
console.log(`TOKEN:   ${TOKEN ? TOKEN.slice(0, 12) + '…' + ` (${TOKEN.length} chars)` : '❌ NOT SET'}`);
console.log(`CHAT_ID: ${CHAT_ID || '❌ NOT SET'}`);

if (!TOKEN || !CHAT_ID) {
  console.log('\n⚠️  Fill both in .env first.');
  process.exit(1);
}

console.log('\nSending [JOB] test message…');
const jobRes = await notify.applySuccess('TestCo', 'Sanity Check', 'tmp/test').catch(e => ({ ok: false, error: e.message }));
if (jobRes.ok) {
  console.log('✓ [JOB] message sent.');
} else {
  console.log('⚠ [JOB] message failed:', JSON.stringify(jobRes));
}

console.log('\nSending [PHD] digest test message…');
const phdRes = await notify.phd.digestReady('2026-05-17', 0).catch(e => ({ ok: false, error: e.message }));
if (phdRes.ok) {
  console.log('✓ [PHD] digestReady sent.');
} else {
  console.log('⚠ [PHD] digestReady failed:', JSON.stringify(phdRes));
}

console.log('\nSending [PHD] topN test message (empty list)…');
const topNRes = await notify.phd.topN([]).catch(e => ({ ok: false, error: e.message }));
if (topNRes.ok) {
  console.log('✓ [PHD] topN sent.');
} else {
  console.log('⚠ [PHD] topN failed:', JSON.stringify(topNRes));
}

console.log('\nDone. Check your Telegram for 2 messages: one [JOB] and one [PHD].');
