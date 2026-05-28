#!/usr/bin/env node
/**
 * Telegram long-poller — prints each new incoming message as one JSON line.
 * Uses curl via child_process (Node fetch fails on this Windows box with ETIMEDOUT).
 *
 *   node tg_poll.mjs
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const TOKEN = process.env.TG_TOKEN || '8878467259:AAGAWwmKk2F6zazVBbVewZ2_n9GCo19R29o';
const OFFSET_FILE = process.env.TG_OFFSET_FILE || 'tmp/tg_offset.txt';
const API = `https://api.telegram.org/bot${TOKEN}`;

function loadOffset() {
  if (!existsSync(OFFSET_FILE)) return 0;
  try {
    return parseInt(readFileSync(OFFSET_FILE, 'utf-8').trim(), 10) || 0;
  } catch { return 0; }
}

function saveOffset(o) {
  mkdirSync(dirname(OFFSET_FILE), { recursive: true });
  writeFileSync(OFFSET_FILE, String(o), 'utf-8');
}

function curlGet(baseUrl, params = {}, timeoutSec = 30) {
  // -G converts -d into query string, avoiding & shell interpretation on Windows
  const args = ['-s', '-4', '-S', '--show-error', '-G', '--max-time', String(timeoutSec)];
  for (const [k, v] of Object.entries(params)) {
    args.push('--data-urlencode', `${k}=${v}`);
  }
  args.push(baseUrl);
  try {
    const out = execFileSync('curl', args, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString() : '';
    const stdout = e.stdout ? e.stdout.toString() : '';
    throw new Error(`curl exit ${e.status}: stderr=${stderr.slice(0, 200)} stdout=${stdout.slice(0, 200)}`);
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function poll() {
  let offset = loadOffset();
  if (offset === 0) {
    try {
      const init = curlGet(`${API}/getUpdates`, { timeout: 0 }, 10);
      if (init.ok && init.result.length > 0) {
        offset = Math.max(...init.result.map(u => u.update_id)) + 1;
        saveOffset(offset);
      }
    } catch (e) {
      process.stderr.write(`init err: ${e.message}\n`);
    }
    process.stderr.write(`tg_poll started — offset=${offset}\n`);
  }

  while (true) {
    try {
      const json = curlGet(`${API}/getUpdates`, { offset, timeout: 25 }, 30);
      if (!json.ok) {
        process.stderr.write(`api err: ${JSON.stringify(json)}\n`);
        await sleep(5000);
        continue;
      }
      for (const upd of json.result) {
        offset = Math.max(offset, upd.update_id + 1);
        const compact = {
          update_id: upd.update_id,
          chat_id: upd.message?.chat?.id,
          from: `${upd.message?.from?.first_name || ''} ${upd.message?.from?.last_name || ''}`.trim(),
          text: upd.message?.text || null,
          has_photo: !!upd.message?.photo,
          photo_file_id: upd.message?.photo?.[upd.message.photo.length - 1]?.file_id || null,
          caption: upd.message?.caption || null,
          date: upd.message?.date,
        };
        process.stdout.write(JSON.stringify(compact) + '\n');
      }
      if (json.result.length > 0) saveOffset(offset);
    } catch (e) {
      process.stderr.write(`loop err: ${e.message}\n`);
      await sleep(5000);
    }
  }
}

poll().catch(err => {
  process.stderr.write(`FATAL: ${err.message}\n`);
  process.exit(1);
});
