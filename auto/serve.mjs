#!/usr/bin/env node
/**
 * Localhost dashboard server.
 *
 *   node auto/serve.mjs              → http://localhost:4280
 *   node auto/serve.mjs --port 8080  → custom port
 *   node auto/serve.mjs --no-regen   → skip regenerating dashboard on every / request
 *
 * Behavior:
 *   - GET /                         → regenerates dashboard.html, serves it
 *   - GET /dashboard.html           → same as /
 *   - GET /tmp/runs/...             → serves any artefact (cv.pdf, screenshots, jd.md, etc.)
 *   - GET /api/status               → JSON list of runs + current stages
 *   - POST /api/status              → JSON body { slug, stage, note? } updates status.yml
 *
 * No external deps (uses Node built-ins).
 */
import { createServer } from 'http';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, extname, join, normalize, relative } from 'path';
import { spawn } from 'child_process';
import yaml from 'js-yaml';

const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(argv[portArg + 1]) : 4280;
const NO_REGEN = argv.includes('--no-regen');
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.webp': 'image/webp',
};

function regenerate() {
  return new Promise((resolveP) => {
    const p = spawn('node', [resolve('auto/dashboard.mjs')], { cwd: ROOT });
    p.on('exit', () => resolveP());
    p.on('error', () => resolveP());
  });
}

function safePath(reqPath) {
  // Prevent path traversal
  const decoded = decodeURIComponent(reqPath);
  const abs = normalize(join(ROOT, decoded));
  if (!abs.startsWith(ROOT)) return null;
  return abs;
}

async function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function serveFile(res, path) {
  try {
    const st = await stat(path);
    if (st.isDirectory()) {
      // List minimal directory index
      const items = await readdir(path);
      const links = items.map(n => `<li><a href="${encodeURIComponent(n)}">${n}</a></li>`).join('');
      return send(res, 200, `<html><body style="font-family:monospace;padding:20px"><h2>${relative(ROOT, path) || '/'}</h2><ul>${links}</ul></body></html>`, { 'content-type': 'text/html; charset=utf-8' });
    }
    const buf = await readFile(path);
    const type = MIME[extname(path).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, buf, { 'content-type': type, 'cache-control': 'no-store' });
  } catch (e) {
    return send(res, 404, `Not found: ${path}`, { 'content-type': 'text/plain' });
  }
}

async function apiStatusList() {
  const out = [];
  const runsRoot = resolve('tmp/runs');
  if (!existsSync(runsRoot)) return [];
  for (const date of await readdir(runsRoot)) {
    const dDir = join(runsRoot, date);
    if (!(await stat(dDir)).isDirectory()) continue;
    for (const slug of await readdir(dDir)) {
      const runDir = join(dDir, slug);
      if (!(await stat(runDir)).isDirectory()) continue;
      const sp = join(runDir, 'status.yml');
      if (!existsSync(sp)) continue;
      const data = yaml.load(await readFile(sp, 'utf-8')) || {};
      out.push({ date, slug, stage: data.stage, notes: data.notes, last_update: String(data.last_update || '') });
    }
  }
  return out.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
}

async function apiStatusUpdate(body) {
  const { slug, stage, note } = body || {};
  if (!slug || !stage) return { ok: false, error: 'slug + stage required' };
  // Find the run dir whose slug contains the substring
  const runsRoot = resolve('tmp/runs');
  for (const date of await readdir(runsRoot)) {
    const dDir = join(runsRoot, date);
    if (!(await stat(dDir)).isDirectory()) continue;
    for (const s of await readdir(dDir)) {
      if (!s.toLowerCase().includes(slug.toLowerCase())) continue;
      const runDir = join(dDir, s);
      const sp = join(runDir, 'status.yml');
      const current = existsSync(sp) ? (yaml.load(await readFile(sp, 'utf-8')) || {}) : {};
      const out = [
        `# Update this file as the application progresses.`,
        `# Valid stages: submitted, viewed, screen, interview-1, interview-2, interview-final, offer, rejected, withdrawn, ghosted, dry-run`,
        `stage: ${stage}`,
        `submitted_at: ${current.submitted_at || new Date().toISOString()}`,
        `last_update: ${new Date().toISOString()}`,
        `notes: ${JSON.stringify(note ?? current.notes ?? '')}`,
      ].join('\n');
      await writeFile(sp, out);
      return { ok: true, run: `${date}/${s}`, stage, note };
    }
  }
  return { ok: false, error: `no run matched "${slug}"` };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // API
    if (path === '/api/status' && req.method === 'GET') {
      const list = await apiStatusList();
      return send(res, 200, JSON.stringify(list, null, 2), { 'content-type': 'application/json' });
    }
    if (path === '/api/status' && req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf-8');
      let payload; try { payload = JSON.parse(body); } catch { payload = null; }
      const result = await apiStatusUpdate(payload);
      return send(res, result.ok ? 200 : 400, JSON.stringify(result, null, 2), { 'content-type': 'application/json' });
    }
    if (path === '/api/regen' && req.method === 'POST') {
      await regenerate();
      return send(res, 200, JSON.stringify({ ok: true }), { 'content-type': 'application/json' });
    }

    // Dashboard root: regen on the fly, then serve
    if (path === '/' || path === '/dashboard.html' || path === '/dashboard') {
      if (!NO_REGEN) await regenerate();
      return serveFile(res, resolve('dashboard.html'));
    }

    // Static
    const target = safePath(path);
    if (!target) return send(res, 403, 'Forbidden');
    return serveFile(res, target);
  } catch (e) {
    return send(res, 500, `Server error: ${e.message}`);
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is in use. Try:  node auto/serve.mjs --port ${PORT + 10}`);
  } else {
    console.error(e);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(``);
  console.log(`  career-ops dashboard`);
  console.log(``);
  console.log(`  → http://localhost:${PORT}/`);
  console.log(``);
  console.log(`  Endpoints:`);
  console.log(`    GET  /                  dashboard (auto-regenerates)`);
  console.log(`    GET  /tmp/runs/...      run artefacts (cv.pdf, screenshots, jd.md)`);
  console.log(`    GET  /api/status        JSON list of runs + stages`);
  console.log(`    POST /api/status        { slug, stage, note? } update status.yml`);
  console.log(`    POST /api/regen         force regenerate dashboard.html`);
  console.log(``);
  console.log(`  Press Ctrl+C to stop.`);
  console.log(``);
});
