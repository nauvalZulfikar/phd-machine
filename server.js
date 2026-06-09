#!/usr/bin/env node
// Standalone dashboard API for the `phd` ops project.
// Zero dependencies — Node built-in http only. Listens on :4102.
// Serves GET /api/dashboard as the "API receptionist" for web_prtfl.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 4102;
const ALLOW_ORIGIN = "http://localhost:3001";
const TRACKER = path.join(__dirname, "TRACKER.csv");

// --- minimal CSV parser (handles quoted fields with commas) ---
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (c === "\r") {
      /* skip */
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadOpportunities() {
  const raw = fs.readFileSync(TRACKER, "utf8");
  const rows = parseCsv(raw).filter((r) => r.length > 1);
  const header = rows.shift();
  return rows.map((r) => {
    const o = {};
    header.forEach((h, i) => {
      o[h] = (r[i] || "").trim();
    });
    return o;
  });
}

function classify(status) {
  const s = (status || "").toUpperCase();
  if (s.startsWith("SUBMITTED")) return "submitted";
  if (s.startsWith("DRAFTED")) return "drafted";
  if (s.startsWith("SKIPPED")) return "skipped";
  if (s.startsWith("SKELETON") || s.startsWith("FUTURE")) return "future";
  return "other";
}

function buildDashboard() {
  let opps;
  try {
    opps = loadOpportunities();
  } catch (e) {
    return {
      project: "phd",
      status: "blocked",
      summary: `Could not read TRACKER.csv: ${e.message}`,
      stats: {},
      last_activity_at: new Date().toISOString(),
      items: [],
    };
  }

  const buckets = { submitted: 0, drafted: 0, skipped: 0, future: 0, other: 0 };
  for (const o of opps) buckets[classify(o.submission_status)]++;

  const pendingInquiries = opps.filter((o) =>
    (o.inquiry_email_status || "").toUpperCase().includes("PENDING"),
  ).length;
  const tierA = opps.filter((o) => o.fit_tier === "A").length;

  // applications still needing action = not submitted and not skipped/future
  const applicationsPending = buckets.drafted + buckets.other;

  // Pick the soonest real upcoming deadline for the summary.
  const dated = opps
    .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(o.deadline))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const nextDeadline = dated.find(
    (o) => classify(o.submission_status) !== "submitted",
  );

  const status = applicationsPending > 0 ? "active" : "idle";
  const summary =
    `${opps.length} PhD opportunities tracked: ${buckets.submitted} submitted, ` +
    `${buckets.drafted} drafted, ${applicationsPending} pending action.` +
    (nextDeadline
      ? ` Next deadline: ${nextDeadline.institution} (${nextDeadline.deadline}).`
      : "");

  const items = opps
    .filter((o) => classify(o.submission_status) !== "future")
    .slice(0, 10)
    .map((o) => ({
      id: o.opp_id,
      institution: o.institution,
      programme: o.programme,
      deadline: o.deadline,
      fit_tier: o.fit_tier,
      status: o.submission_status,
    }));

  return {
    project: "phd",
    status,
    summary,
    stats: {
      total_opportunities: opps.length,
      applications_pending: applicationsPending,
      submitted: buckets.submitted,
      drafted: buckets.drafted,
      skipped: buckets.skipped,
      future_cycle: buckets.future,
      tier_A: tierA,
      inquiry_emails_pending: pendingInquiries,
    },
    last_activity_at: new Date().toISOString(),
    items,
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Origin":
      origin === ALLOW_ORIGIN ? origin : ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = (req.url || "").split("?")[0];

  if (req.method === "GET" && url === "/api/dashboard") {
    res.writeHead(200, headers);
    res.end(JSON.stringify(buildDashboard(), null, 2));
    return;
  }

  if (req.method === "GET" && (url === "/" || url === "/health")) {
    res.writeHead(200, headers);
    res.end(
      JSON.stringify({ ok: true, service: "phd-dashboard-api", port: PORT }),
    );
    return;
  }

  res.writeHead(404, headers);
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, () => {
  console.log(
    `phd dashboard API listening on http://localhost:${PORT}/api/dashboard`,
  );
});
