#!/usr/bin/env node
/**
 * Dashboard generator: scans tmp/runs/<date>/<run>/, aggregates summary + status,
 * produces a self-contained static `dashboard.html` (no server, no deps).
 *
 * Run:   node auto/dashboard.mjs
 * Open:  dashboard.html in browser
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';
import yaml from 'js-yaml';

const ROOT = resolve('.');
const RUNS_DIR = resolve('tmp/runs');
const OUT = resolve('dashboard.html');

function readMaybe(p) { try { return readFileSync(p, 'utf-8'); } catch { return null; } }
function readJsonMaybe(p) { const t = readMaybe(p); try { return t ? JSON.parse(t) : null; } catch { return null; } }
function readYamlMaybe(p) { const t = readMaybe(p); try { return t ? yaml.load(t) : null; } catch { return null; } }

function collect() {
  if (!existsSync(RUNS_DIR)) return [];
  const out = [];
  for (const date of readdirSync(RUNS_DIR)) {
    const dateDir = join(RUNS_DIR, date);
    if (!statSync(dateDir).isDirectory()) continue;
    for (const slug of readdirSync(dateDir)) {
      const runDir = join(dateDir, slug);
      if (!statSync(runDir).isDirectory()) continue;
      const summary = readJsonMaybe(join(runDir, 'summary.json'));
      if (!summary) continue;
      const schema = readJsonMaybe(join(runDir, 'form-schema.json')) || [];
      const answers = readJsonMaybe(join(runDir, 'answers.json')) || {};
      const status = readYamlMaybe(join(runDir, 'status.yml')) || {};
      const jdMd = readMaybe(join(runDir, 'jd.md')) || '';
      const confirmationTxt = readMaybe(join(runDir, 'confirmation.txt')) || '';
      out.push({
        date, slug, runDir,
        summary, schema, answers, status,
        jdMd, confirmationTxt,
        relRunDir: relative(ROOT, runDir).replace(/\\/g, '/'),
      });
    }
  }
  // Newest first
  out.sort((a, b) => (b.summary?.timestamp || '').localeCompare(a.summary?.timestamp || ''));
  return out;
}

const STAGE_ORDER = ['dry-run', 'submitted', 'viewed', 'screen', 'interview-1', 'interview-2', 'interview-final', 'offer', 'rejected', 'withdrawn', 'ghosted'];
const STAGE_COLOR = {
  'dry-run': '#9ca3af', 'submitted': '#3b82f6', 'viewed': '#8b5cf6',
  'screen': '#a855f7', 'interview-1': '#ec4899', 'interview-2': '#f43f5e',
  'interview-final': '#f97316', 'offer': '#10b981', 'rejected': '#ef4444',
  'withdrawn': '#6b7280', 'ghosted': '#475569',
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function statCard(label, value, color) {
  return `<div class="stat" style="border-left:4px solid ${color}"><div class="stat-num">${value}</div><div class="stat-label">${esc(label)}</div></div>`;
}

function renderQA(schema, answers) {
  if (!schema.length) return '<p class="muted">(no schema)</p>';
  return `<table class="qa"><thead><tr><th>#</th><th>Field</th><th>Type</th><th>Req</th><th>Answer</th></tr></thead><tbody>${
    schema.map((f, i) => {
      const ans = answers[f.id];
      const ansDisplay = ans === undefined ? '<em class="muted">—</em>'
        : ans === true ? 'YES'
        : ans === false ? 'NO'
        : esc(String(ans));
      return `<tr><td>${i + 1}</td><td>${esc(f.label)}</td><td><code>${esc(f.type)}</code></td><td>${f.required ? '✓' : ''}</td><td>${ansDisplay}</td></tr>`;
    }).join('')
  }</tbody></table>`;
}

function renderRun(r) {
  const j = r.summary.job || {};
  const stage = r.status.stage || (r.summary.submission?.success ? 'submitted' : 'dry-run');
  const color = STAGE_COLOR[stage] || '#6b7280';
  const submitted = r.summary.submission?.success;
  const submissionText = submitted ? r.summary.submission.confirmationText : '';
  return `<details class="run">
  <summary class="run-summary">
    <span class="badge" style="background:${color}">${esc(stage)}</span>
    <span class="run-co">${esc(j.company || '?')}</span>
    <span class="run-title">${esc(j.title || '?')}</span>
    <span class="run-meta">${esc(j.location || '')} · <code>${esc(j.ats || '?')}</code> · ${esc(r.date)}</span>
    ${submitted ? '<span class="ok">✓ submitted</span>' : '<span class="dry">dry-run</span>'}
  </summary>

  <div class="run-body">
    <div class="run-cols">
      <div class="col">
        <h4>Artifacts</h4>
        <ul class="files">
          <li><a href="${r.relRunDir}/cv.pdf" target="_blank">cv.pdf</a> · <a href="${r.relRunDir}/cv.html" target="_blank">html</a></li>
          <li><a href="${r.relRunDir}/cl.pdf" target="_blank">cl.pdf</a> · <a href="${r.relRunDir}/cl.html" target="_blank">html</a></li>
          <li><a href="${r.relRunDir}/jd.md" target="_blank">jd.md</a></li>
          <li><a href="${r.relRunDir}/form-filled.png" target="_blank">form-filled.png</a></li>
          ${submitted ? `<li><a href="${r.relRunDir}/confirmation.png" target="_blank">confirmation.png</a> · <a href="${r.relRunDir}/confirmation.txt" target="_blank">.txt</a></li>` : ''}
          <li><a href="${r.relRunDir}/answers.json" target="_blank">answers.json</a> · <a href="${r.relRunDir}/form-schema.json" target="_blank">form-schema.json</a></li>
          <li><a href="${r.relRunDir}/status.yml" target="_blank">status.yml</a> · <a href="${r.relRunDir}/summary.json" target="_blank">summary.json</a></li>
        </ul>
        <h4>Status</h4>
        <pre class="yaml">${esc(yaml.dump(r.status))}</pre>
        ${submitted ? `<h4>Submission confirmation</h4><pre class="conf">${esc(submissionText)}</pre>` : ''}
      </div>

      <div class="col col-wide">
        <h4>Questions &amp; Answers (${r.schema.length} fields, ${Object.keys(r.answers).length} answered)</h4>
        ${renderQA(r.schema, r.answers)}
      </div>
    </div>

    <details class="jd-box">
      <summary><strong>Job Description</strong> (click to expand)</summary>
      <pre class="jd">${esc(r.jdMd)}</pre>
    </details>
  </div>
</details>`;
}

function html(runs) {
  // Stats
  const byStage = {};
  const byAts = {};
  const byCompany = {};
  const byDate = {};
  for (const r of runs) {
    const stage = r.status.stage || (r.summary.submission?.success ? 'submitted' : 'dry-run');
    byStage[stage] = (byStage[stage] || 0) + 1;
    const ats = r.summary.ats || r.summary.job?.ats || '?';
    byAts[ats] = (byAts[ats] || 0) + 1;
    const co = r.summary.job?.company || '?';
    byCompany[co] = (byCompany[co] || 0) + 1;
    byDate[r.date] = (byDate[r.date] || 0) + 1;
  }
  const stageCards = STAGE_ORDER.filter(s => byStage[s]).map(s => statCard(s, byStage[s], STAGE_COLOR[s])).join('');
  const atsCards = Object.entries(byAts).map(([k, v]) => statCard(k, v, '#0ea5e9')).join('');
  const totalSubmitted = (byStage.submitted || 0) + (byStage.viewed || 0) + (byStage.screen || 0) + (byStage['interview-1'] || 0) + (byStage['interview-2'] || 0) + (byStage['interview-final'] || 0) + (byStage.offer || 0) + (byStage.rejected || 0) + (byStage.ghosted || 0);

  // Funnel: cumulative count of apps that reached each stage or further
  // (treating advancement as monotonic from submitted → offer)
  const FUNNEL = ['submitted', 'viewed', 'screen', 'interview-1', 'interview-2', 'interview-final', 'offer'];
  const advancementRank = Object.fromEntries(FUNNEL.map((s, i) => [s, i]));
  // For each run, find its furthest stage; we don't track history yet so just use current.
  const stageRank = (s) => advancementRank[s] ?? -1;
  const funnelCounts = FUNNEL.map((stage, idx) =>
    runs.filter(r => stageRank(r.status.stage) >= idx).length
  );
  const submittedTotal = funnelCounts[0] || 1;
  const responseRate = ((funnelCounts[1] + (byStage.screen || 0) + (byStage['interview-1'] || 0) + (byStage['interview-2'] || 0) + (byStage['interview-final'] || 0) + (byStage.offer || 0)) / submittedTotal * 100).toFixed(0);
  const offerRate = (((byStage.offer || 0) / submittedTotal) * 100).toFixed(0);
  const rejectedCount = byStage.rejected || 0;
  const ghostedCount = byStage.ghosted || 0;

  // ── SANKEY (main visual) ─────────────────────────────────────────
  // For each run, infer the path applied → submitted → ... → current_stage
  // Terminals: offer, rejected, ghosted, withdrawn — stop there
  // Active terminals: still@<current> (shows where active apps currently sit)
  const STAGE_FLOW = ['applied', 'submitted', 'viewed', 'screen', 'interview-1', 'interview-2', 'interview-final', 'offer'];
  const TERMINALS = new Set(['offer', 'rejected', 'withdrawn', 'ghosted']);
  const linkMap = new Map();
  const addLink = (s, t, v = 1) => {
    const k = `${s}|${t}`;
    linkMap.set(k, (linkMap.get(k) || 0) + v);
  };
  for (const r of runs) {
    const cur = r.status.stage || 'submitted';
    if (cur === 'dry-run') continue;
    if (cur === 'offer') {
      for (let i = 0; i < STAGE_FLOW.length - 1; i++) addLink(STAGE_FLOW[i], STAGE_FLOW[i + 1]);
    } else if (TERMINALS.has(cur)) {
      // We don't track where rejection happened — treat as direct from submitted
      addLink('applied', 'submitted');
      addLink('submitted', cur);
    } else {
      // Active: walk from applied to current
      let prev = 'applied';
      for (const s of STAGE_FLOW) {
        if (s === 'applied') continue;
        addLink(prev, s);
        prev = s;
        if (s === cur) break;
      }
      addLink(cur, `still @ ${cur}`);
    }
  }
  const sankeyLinks = [...linkMap.entries()].map(([k, v]) => {
    const [source, target] = k.split('|');
    return { source, target, value: v };
  });

  // Layout
  const NODE_W = 22;
  const VAL_SCALE = 60;       // pixels per app unit — big bars are the point
  const COL_GAP = 210;
  const VERT_PAD = 60;        // space between nodes in same column for label breathing room
  const TOP_PAD = 50;
  const LEFT_PAD = 90;
  const STAGE_COL = { applied: 0, submitted: 1, viewed: 2, screen: 3, 'interview-1': 4, 'interview-2': 5, 'interview-final': 6, offer: 7, rejected: 7, ghosted: 7, withdrawn: 7 };
  const nodeMap = new Map();
  for (const l of sankeyLinks) {
    if (!nodeMap.has(l.source)) nodeMap.set(l.source, { name: l.source, inValue: 0, outValue: 0 });
    if (!nodeMap.has(l.target)) nodeMap.set(l.target, { name: l.target, inValue: 0, outValue: 0 });
    nodeMap.get(l.source).outValue += l.value;
    nodeMap.get(l.target).inValue += l.value;
  }
  for (const n of nodeMap.values()) {
    if (STAGE_COL[n.name] !== undefined) n.column = STAGE_COL[n.name];
    else if (n.name.startsWith('still @ ')) n.column = (STAGE_COL[n.name.slice(8)] ?? 0) + 1;
    else n.column = 7;
    n.totalValue = Math.max(n.inValue, n.outValue);
  }
  const byCol = new Map();
  for (const n of nodeMap.values()) {
    if (!byCol.has(n.column)) byCol.set(n.column, []);
    byCol.get(n.column).push(n);
  }
  // Sort within column: main flow nodes first, "still @" terminals at bottom
  for (const arr of byCol.values()) {
    arr.sort((a, b) => {
      const aStill = a.name.startsWith('still @ ');
      const bStill = b.name.startsWith('still @ ');
      if (aStill !== bStill) return aStill ? 1 : -1;
      const order = ['offer', 'rejected', 'ghosted', 'withdrawn'];
      return (order.indexOf(a.name) - order.indexOf(b.name));
    });
  }
  for (const [col, nodes] of byCol) {
    let yOff = TOP_PAD;
    for (const n of nodes) {
      n.x = LEFT_PAD + col * COL_GAP;
      n.y = yOff;
      n.height = Math.max(8, n.totalValue * VAL_SCALE);
      yOff += n.height + VERT_PAD;
    }
  }
  for (const n of nodeMap.values()) { n.outYOff = n.y; n.inYOff = n.y; }
  for (const l of sankeyLinks) {
    const s = nodeMap.get(l.source), t = nodeMap.get(l.target);
    l.srcX = s.x + NODE_W;
    l.tgtX = t.x;
    l.srcY0 = s.outYOff;
    s.outYOff += l.value * VAL_SCALE;
    l.srcY1 = s.outYOff;
    l.tgtY0 = t.inYOff;
    t.inYOff += l.value * VAL_SCALE;
    l.tgtY1 = t.inYOff;
  }
  const maxCol = Math.max(...[...nodeMap.values()].map(n => n.column), 0);
  const sankeyW = LEFT_PAD * 2 + maxCol * COL_GAP + NODE_W;
  const sankeyH = Math.max(...[...byCol.values()].map(arr => arr.length ? (arr[arr.length - 1].y + arr[arr.length - 1].height) : 0), 240) + 40;

  function nodeColor(name) {
    if (STAGE_COLOR[name]) return STAGE_COLOR[name];
    if (name === 'applied') return '#0891b2';
    if (name.startsWith('still @ ')) {
      const stage = name.slice(8);
      return STAGE_COLOR[stage] || '#94a3b8';
    }
    return '#94a3b8';
  }

  const sankeySvg = `<svg viewBox="0 0 ${sankeyW} ${sankeyH}" class="sankey" preserveAspectRatio="xMidYMid meet">
  <defs>
    ${sankeyLinks.map((l, i) => {
      const sc = nodeColor(l.source);
      const tc = nodeColor(l.target);
      return `<linearGradient id="lg${i}" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${sc}" stop-opacity="0.55"/><stop offset="100%" stop-color="${tc}" stop-opacity="0.55"/></linearGradient>`;
    }).join('\n    ')}
  </defs>
  <g>
    ${sankeyLinks.map((l, i) => {
      const midX = (l.srcX + l.tgtX) / 2;
      const path = `M ${l.srcX},${l.srcY0} C ${midX},${l.srcY0} ${midX},${l.tgtY0} ${l.tgtX},${l.tgtY0} L ${l.tgtX},${l.tgtY1} C ${midX},${l.tgtY1} ${midX},${l.srcY1} ${l.srcX},${l.srcY1} Z`;
      return `<path d="${path}" fill="url(#lg${i})" class="sankey-link" data-from="${esc(l.source)}" data-to="${esc(l.target)}" data-val="${l.value}"><title>${esc(l.source)} → ${esc(l.target)}: ${l.value}</title></path>`;
    }).join('\n    ')}
  </g>
  <g>
    ${[...nodeMap.values()].map(n => {
      const color = nodeColor(n.name);
      // Place labels ABOVE each node (centered) — avoids horizontal collisions entirely
      const labelX = n.x + NODE_W / 2;
      const labelY = n.y - 12;
      const valueY = n.y + n.height + 18;
      return `<g class="sankey-node">
        <rect x="${n.x}" y="${n.y}" width="${NODE_W}" height="${n.height}" fill="${color}" rx="3"><title>${esc(n.name)}: ${n.totalValue}</title></rect>
        <text x="${labelX}" y="${labelY}" text-anchor="middle" class="sankey-lbl" fill="${color}">${esc(n.name)}</text>
        <text x="${labelX}" y="${valueY}" text-anchor="middle" class="sankey-val" fill="${color}">${n.totalValue}</text>
      </g>`;
    }).join('\n    ')}
  </g>
</svg>`;

  // Funnel SVG (kept as compact stat in conversion row, not main visual)
  const maxFunnel = Math.max(...funnelCounts, 1);
  const funnelSvg = `<svg viewBox="0 0 640 ${FUNNEL.length * 30 + 8}" class="chart-svg" preserveAspectRatio="none">
    ${FUNNEL.map((s, i) => {
      const w = (funnelCounts[i] / maxFunnel) * 440;
      const color = STAGE_COLOR[s];
      return `<g transform="translate(0,${i * 30})">
        <text x="0" y="20" class="lbl">${esc(s)}</text>
        <rect x="120" y="6" width="${w}" height="20" fill="${color}" rx="3" />
        <text x="${130 + w}" y="20" class="val" fill="${color}">${funnelCounts[i]}</text>
      </g>`;
    }).join('')}
  </svg>`;

  // Timeline: apps per date (horizontal bar)
  const dates = Object.keys(byDate).sort();
  const maxPerDay = Math.max(...Object.values(byDate), 1);
  const tlW = 600, tlH = 100, padL = 50, padR = 20, padT = 14, padB = 24;
  const innerW = tlW - padL - padR;
  const barW = dates.length ? innerW / dates.length : 0;
  const timelineSvg = `<svg viewBox="0 0 ${tlW} ${tlH}" class="chart-svg" preserveAspectRatio="none">
    <line x1="${padL}" y1="${tlH - padB}" x2="${tlW - padR}" y2="${tlH - padB}" stroke="#cbd5e1" />
    ${dates.map((d, i) => {
      const c = byDate[d];
      const h = (c / maxPerDay) * (tlH - padT - padB);
      const x = padL + i * barW + barW * 0.15;
      const y = tlH - padB - h;
      return `<g>
        <rect x="${x}" y="${y}" width="${barW * 0.7}" height="${h}" fill="#0891b2" rx="2" />
        <text x="${x + barW * 0.35}" y="${y - 4}" text-anchor="middle" class="tl-val">${c}</text>
        <text x="${x + barW * 0.35}" y="${tlH - 8}" text-anchor="middle" class="tl-lbl">${d.slice(5)}</text>
      </g>`;
    }).join('')}
    <text x="${padL - 4}" y="${tlH - padB + 4}" text-anchor="end" class="tl-lbl">0</text>
    <text x="${padL - 4}" y="${padT + 8}" text-anchor="end" class="tl-lbl">${maxPerDay}</text>
  </svg>`;

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<title>career-ops — Auto-Apply Dashboard</title>
<style>
  :root { --bg:#f8fafc; --panel:#fff; --line:#e2e8f0; --text:#0f172a; --muted:#64748b; --accent:#0891b2; }
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,Segoe UI,Inter,sans-serif;background:var(--bg);color:var(--text);font-size:14px}
  .wrap{max-width:1600px;margin:0 auto;padding:32px}
  h1{margin:0 0 6px;font-size:26px;letter-spacing:-0.01em}
  .sub{color:var(--muted);margin-bottom:24px;font-size:13px}
  .sankey-panel{background:var(--panel);border-radius:8px;border:1px solid var(--line);padding:24px 24px 28px;margin-bottom:28px}
  .sankey-panel h2{font-size:18px;font-weight:600;letter-spacing:-0.01em;margin:0 0 4px}
  .sankey-panel .sub2{color:var(--muted);font-size:12px;margin-bottom:10px}
  .sankey{width:100%;height:auto;display:block}
  .sankey-lbl{font-size:13px;font-family:ui-monospace,monospace;font-weight:600}
  .sankey-val{font-size:18px;font-weight:700;font-family:-apple-system,Inter,sans-serif}
  .sankey-link{transition:opacity 0.15s}
  .sankey-link:hover{opacity:1 !important;cursor:pointer}
  .sankey:hover .sankey-link{opacity:0.4}
  .sankey-node rect{transition:filter 0.15s}
  .sankey-node:hover rect{filter:brightness(1.1)}
  .row{display:flex;gap:32px;flex-wrap:wrap;margin-bottom:28px}
  .row-block h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted)}
  .stats{display:flex;gap:10px;flex-wrap:wrap}
  .stat{background:var(--panel);padding:14px 18px;border-radius:6px;min-width:120px}
  .stat-num{font-size:24px;font-weight:700}
  .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted);margin-top:2px}
  .toolbar{display:flex;gap:12px;align-items:center;margin-bottom:14px}
  .toolbar input{padding:8px 12px;border:1px solid var(--line);border-radius:6px;font-size:13px;min-width:280px;font-family:inherit}
  .runs{display:flex;flex-direction:column;gap:8px}
  details.run{background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden}
  details.run[open]{box-shadow:0 4px 12px rgba(0,0,0,.04)}
  summary.run-summary{cursor:pointer;padding:14px 18px;display:flex;gap:12px;align-items:center;list-style:none}
  summary.run-summary::-webkit-details-marker{display:none}
  .badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:3px;color:#fff;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap}
  .run-co{font-weight:600;color:var(--accent)}
  .run-title{flex:1;color:var(--text)}
  .run-meta{font-size:12px;color:var(--muted)}
  .ok{color:#10b981;font-weight:600;font-size:12px}
  .dry{color:var(--muted);font-size:12px}
  .run-body{padding:0 18px 18px;border-top:1px solid var(--line)}
  .run-cols{display:flex;gap:24px;padding-top:14px;flex-wrap:wrap}
  .col{flex:1;min-width:260px}
  .col-wide{flex:2;min-width:520px}
  .col h4{margin:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted)}
  .col h4:first-child{margin-top:0}
  .files{list-style:none;padding:0;margin:0;font-family:ui-monospace,monospace;font-size:12px}
  .files li{padding:3px 0;border-bottom:1px dashed var(--line)}
  .files a{color:var(--accent);text-decoration:none}
  .files a:hover{text-decoration:underline}
  pre.yaml,pre.conf,pre.jd{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:4px;font-size:11.5px;line-height:1.55;overflow:auto;font-family:ui-monospace,monospace;margin:0;max-height:320px}
  pre.jd{max-height:480px;white-space:pre-wrap;word-wrap:break-word}
  table.qa{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid var(--line)}
  table.qa th{background:#f1f5f9;text-align:left;padding:7px 10px;font-weight:600;border-bottom:1px solid var(--line);font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted)}
  table.qa td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  table.qa td:nth-child(1){color:var(--muted);width:24px}
  table.qa td:nth-child(3){width:90px}
  table.qa td:nth-child(4){width:40px;text-align:center}
  table.qa code{font-size:10.5px;background:#f1f5f9;padding:1px 5px;border-radius:3px;color:#475569}
  .charts{align-items:stretch}
  .chart-block{flex:1;min-width:380px;background:var(--panel);padding:18px;border-radius:6px;border:1px solid var(--line)}
  .chart-svg{width:100%;height:auto;display:block;margin-top:8px}
  .chart-svg .lbl{font-size:11px;fill:#475569;font-family:ui-monospace,monospace}
  .chart-svg .val{font-size:12px;font-weight:600;dominant-baseline:middle}
  .chart-svg .tl-val{font-size:10px;fill:#475569;font-weight:600}
  .chart-svg .tl-lbl{font-size:10px;fill:#94a3b8}
  .row-collapse{margin-bottom:24px}
  .row-collapse summary{cursor:pointer;padding:6px 0;font-size:12px}
  .small{font-size:12px}
  .jd-box{margin-top:18px;border-top:1px dashed var(--line);padding-top:12px}
  .jd-box summary{cursor:pointer;color:var(--muted);font-size:12px}
  .muted{color:var(--muted)}
  em{font-style:normal}
</style></head>
<body>
<div class="wrap">
  <h1>Auto-Apply Dashboard</h1>
  <div class="sub">${runs.length} run${runs.length === 1 ? '' : 's'} · ${totalSubmitted} real submission${totalSubmitted === 1 ? '' : 's'} · generated ${new Date().toLocaleString('en-GB')}</div>

  <!-- Sankey: main visual -->
  <div class="sankey-panel">
    <h2>Application Flow</h2>
    <div class="sub2">${runs.length} application${runs.length === 1 ? '' : 's'} · ${responseRate}% response · ${offerRate}% offer rate · hover a ribbon for source/target</div>
    ${sankeySvg}
  </div>

  <div class="row">
    <div class="row-block"><h3>By stage</h3><div class="stats">${stageCards || '<em class="muted">none yet</em>'}</div></div>
    <div class="row-block"><h3>By ATS</h3><div class="stats">${atsCards || '<em class="muted">none</em>'}</div></div>
    <div class="row-block">
      <h3>Conversion</h3>
      <div class="stats">
        ${statCard('total apps', runs.length, '#0891b2')}
        ${statCard('response rate', responseRate + '%', '#8b5cf6')}
        ${statCard('offer rate', offerRate + '%', '#10b981')}
        ${statCard('rejected', rejectedCount, '#ef4444')}
        ${statCard('ghosted', ghostedCount, '#475569')}
      </div>
    </div>
  </div>

  <details class="row-collapse">
    <summary class="muted small">Secondary charts (funnel, timeline)</summary>
    <div class="row charts">
      <div class="chart-block">
        <h3>Funnel — apps reaching each stage</h3>
        ${funnelSvg}
      </div>
      <div class="chart-block">
        <h3>Timeline — applications submitted per day</h3>
        ${timelineSvg}
      </div>
    </div>
  </details>

  <div class="toolbar">
    <input type="text" id="filter" placeholder="filter by company, role, stage, ATS…" oninput="filterRuns()" />
    <span class="muted" id="count">${runs.length} shown</span>
  </div>

  <div class="runs" id="runs">
    ${runs.map(renderRun).join('\n')}
  </div>
</div>
<script>
  function filterRuns() {
    const q = document.getElementById('filter').value.toLowerCase();
    let shown = 0;
    document.querySelectorAll('details.run').forEach(d => {
      const text = d.innerText.toLowerCase();
      const visible = !q || text.includes(q);
      d.style.display = visible ? '' : 'none';
      if (visible) shown++;
    });
    document.getElementById('count').textContent = shown + ' shown';
  }
</script>
</body></html>`;
}

const runs = collect();
writeFileSync(OUT, html(runs));
console.log(`Dashboard: ${OUT}`);
console.log(`  ${runs.length} runs indexed`);
console.log(`  Open in browser:  file:///${OUT.replace(/\\/g, '/')}`);
