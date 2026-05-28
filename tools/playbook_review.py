"""Aston-playbook compliance reviewer — checks each app for full playbook adherence.

Per-app scorecard with 8 dimensions:
  1. WEIGHTED_GAP.md exists
  2. supervisor_inquiry_email.md exists (or skipped if no supervisor_email)
  3. referee_brief_ammar.md exists
  4. referee_brief_viktor.md exists
  5. RS / research_proposal / project_description cites ≥3 supervisor papers (heuristic)
  6. RS / research_proposal / project_description has mermaid diagram
  7. RS / research_proposal / project_description has '3-Year Workplan' or 'Year 1 / Year 2 / Year 3' section
  8. cover_letter.md cites ≥1 supervisor paper

Output:
  phd-applications/<opp>/PLAYBOOK_COMPLIANCE.md
  phd-applications/_portal_recon/PLAYBOOK_MASTER.md
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
PHD_APPS = REPO_ROOT.parent / "phd-applications"

# Skip dirs that are not apps
SKIP_DIRS = {"shared", "_portal_recon"}

# Apps that are submitted or future-cycle (no playbook expected)
SUBMITTED = {"aston-p196342"}
SKIPPED = {"univie-5509"}
FUTURE = {"york-saints", "mcml-munich"}


def check_file_exists(path: Path) -> bool:
    return path.exists() and path.stat().st_size > 100


def supervisor_surnames(req: dict) -> list[str]:
    """Return all candidate surnames from supervisor field (handles multi-supervisor + parentheticals)."""
    name = req.get("supervisor") or ""
    if not name:
        return []
    # Drop parentheticals e.g. "(promotor)"
    name = re.sub(r"\([^)]*\)", "", name)
    # Split on common multi-supervisor delimiters
    chunks = re.split(r"\s*(?:\+|,|&|\band\b|co-supervised by)\s*", name, flags=re.IGNORECASE)
    surnames = []
    for chunk in chunks:
        c = re.sub(r"^(?:Prof\.?|Dr\.?|Assoc\.?\s*Prof\.?|Asst\.?\s*Prof\.?)\s*", "", chunk, flags=re.IGNORECASE).strip()
        parts = c.split()
        if not parts:
            continue
        last = re.sub(r"[(),.;].*$", "", parts[-1]).strip()
        # Skip role words that slipped through
        if last and last.lower() not in {"supervisor", "promotor", "daily", "group", "(promotor)"}:
            surnames.append(last)
    return surnames


def supervisor_surname(req: dict) -> str | None:
    """Backward-compat: return first surname."""
    s = supervisor_surnames(req)
    return s[0] if s else None


def count_supervisor_cites(md: str, surnames) -> int:
    """Count occurrences of ANY supervisor surname in citation contexts."""
    if not surnames:
        return 0
    if isinstance(surnames, str):
        surnames = [surnames]
    total = 0
    for s in surnames:
        pat = re.compile(rf"\b{re.escape(s)}\b(?:[,.]| et al\.| and |\s*\()", re.IGNORECASE)
        total += len(pat.findall(md))
    return total


def has_mermaid(md: str) -> bool:
    return bool(re.search(r"```mermaid", md, re.IGNORECASE))


def has_3yr_workplan(md: str) -> bool:
    patterns = [
        r"(?im)^#{1,4}\s+(?:.+?)?(?:three-?year|3[-\s]year)\s+work[-\s]?plan",
        r"(?im)^#{1,4}\s+(?:work[-\s]?plan|year[s]?\s+1[-/](?:2|3))",
        r"(?im)\bYear\s+1[\s:].*?\bYear\s+2[\s:].*?\bYear\s+3[\s:]",
    ]
    return any(re.search(p, md, re.DOTALL) for p in patterns)


def find_research_doc(app_dir: Path) -> Path | None:
    drafts = app_dir / "drafts"
    if not drafts.exists():
        return None
    for name in (
        "research_statement.md",
        "research_proposal.md",
        "project_description.md",
        "statement_of_interest.md",
        "personal_statement.md",  # Tel Aviv Letter of Purpose
    ):
        p = drafts / name
        if p.exists():
            return p
    return None


def review_app(app_dir: Path) -> dict:
    req_path = app_dir / "REQUIREMENTS.json"
    if not req_path.exists():
        return {"opp_id": app_dir.name, "error": "no REQUIREMENTS.json"}

    req = json.loads(req_path.read_text(encoding="utf-8"))
    surnames = supervisor_surnames(req)
    surname = surnames[0] if surnames else None
    drafts = app_dir / "drafts"

    checks = {}

    # 1. WEIGHTED_GAP.md
    checks["weighted_gap"] = check_file_exists(app_dir / "WEIGHTED_GAP.md")

    # 2. supervisor_inquiry_email
    if not req.get("supervisor_email"):
        checks["supervisor_inquiry"] = "N/A"
    else:
        checks["supervisor_inquiry"] = check_file_exists(drafts / "supervisor_inquiry_email.md")

    # 3 + 4. referee briefs
    checks["referee_brief_ammar"] = check_file_exists(drafts / "referee_brief_ammar.md")
    checks["referee_brief_viktor"] = check_file_exists(drafts / "referee_brief_viktor.md")

    # 5/6/7. RS / RP / PD checks
    research_doc = find_research_doc(app_dir)
    if research_doc:
        md = research_doc.read_text(encoding="utf-8")
        cites = count_supervisor_cites(md, surnames)
        checks["rs_supervisor_cites"] = f"{cites} cite(s) of {surnames}" if surnames else "N/A"
        checks["rs_supervisor_cites_pass"] = cites >= 3 if surnames else "N/A"
        checks["rs_mermaid_diagram"] = has_mermaid(md)
        checks["rs_3yr_workplan"] = has_3yr_workplan(md)
        checks["rs_file"] = research_doc.name
    else:
        checks["rs_file"] = None
        checks["rs_supervisor_cites"] = "no RS"
        checks["rs_supervisor_cites_pass"] = False
        checks["rs_mermaid_diagram"] = False
        checks["rs_3yr_workplan"] = False

    # 8. cover_letter cites supervisor
    cl = drafts / "cover_letter.md"
    if cl.exists():
        md = cl.read_text(encoding="utf-8")
        cites = count_supervisor_cites(md, surnames)
        checks["cl_supervisor_cites"] = cites if surnames else "N/A"
        checks["cl_supervisor_cite_pass"] = cites >= 1 if surnames else "N/A"
    else:
        checks["cl_supervisor_cites"] = "no CL"
        checks["cl_supervisor_cite_pass"] = False

    return {"opp_id": app_dir.name, "supervisor": req.get("supervisor"), "supervisor_surname": surname, "checks": checks}


def render_app_md(report: dict) -> str:
    c = report["checks"]
    lines = [
        f"# Playbook Compliance — {report['opp_id']}",
        "",
        f"**Supervisor:** {report.get('supervisor', '—')}",
        f"**Surname checked:** {report.get('supervisor_surname', '—')}",
        "",
        "## Aston-playbook checks",
        "",
        "| # | Check | Status |",
        "|---|---|---|",
    ]
    icon = lambda v: "✅" if v is True else ("🟡 N/A" if v == "N/A" else "❌")
    lines += [
        f"| 1 | WEIGHTED_GAP.md exists | {icon(c.get('weighted_gap'))} |",
        f"| 2 | Supervisor inquiry email drafted | {icon(c.get('supervisor_inquiry'))} |",
        f"| 3 | Referee brief — Ammar | {icon(c.get('referee_brief_ammar'))} |",
        f"| 4 | Referee brief — Viktor | {icon(c.get('referee_brief_viktor'))} |",
        f"| 5 | RS cites ≥3 supervisor papers | {icon(c.get('rs_supervisor_cites_pass'))} ({c.get('rs_supervisor_cites')}) |",
        f"| 6 | RS has Mermaid methodology diagram | {icon(c.get('rs_mermaid_diagram'))} |",
        f"| 7 | RS has 3-year workplan | {icon(c.get('rs_3yr_workplan'))} |",
        f"| 8 | Cover letter cites ≥1 supervisor paper | {icon(c.get('cl_supervisor_cite_pass'))} ({c.get('cl_supervisor_cites')}) |",
        "",
        f"_Research doc inspected: {c.get('rs_file') or 'none'}_",
    ]
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    args = ap.parse_args()

    apps = sorted(p for p in PHD_APPS.iterdir() if p.is_dir() and p.name not in SKIP_DIRS)
    if args.only:
        apps = [p for p in apps if p.name == args.only]

    reports = []
    for app_dir in apps:
        r = review_app(app_dir)
        reports.append(r)
        if "error" not in r:
            (app_dir / "PLAYBOOK_COMPLIANCE.md").write_text(render_app_md(r), encoding="utf-8")

    # Master summary
    master_lines = [
        "# Playbook Compliance — Master",
        "",
        "Legend: ✅ pass · ❌ fail · 🟡 N/A or expected to skip · 🚫 submitted/skipped/future",
        "",
        "| App | Tier | Gap | Inquiry | Ref Ammar | Ref Viktor | RS cites | RS diagram | RS workplan | CL cites |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in reports:
        oid = r["opp_id"]
        if oid in SUBMITTED:
            tier = "🟢 submitted"
        elif oid in SKIPPED:
            tier = "⏭️ skipped"
        elif oid in FUTURE:
            tier = "📅 future"
        else:
            tier = "🔧 active"
        c = r.get("checks", {})
        def cell(v):
            if v is True: return "✅"
            if v is False: return "❌"
            if v == "N/A": return "🟡"
            return str(v)
        master_lines.append(
            f"| {oid} | {tier} | {cell(c.get('weighted_gap'))} | {cell(c.get('supervisor_inquiry'))} | "
            f"{cell(c.get('referee_brief_ammar'))} | {cell(c.get('referee_brief_viktor'))} | "
            f"{cell(c.get('rs_supervisor_cites_pass'))} | {cell(c.get('rs_mermaid_diagram'))} | "
            f"{cell(c.get('rs_3yr_workplan'))} | {cell(c.get('cl_supervisor_cite_pass'))} |"
        )

    # Total counts
    total_apps = len([r for r in reports if r["opp_id"] not in SUBMITTED | SKIPPED | FUTURE])
    def count_pass(check_key):
        return sum(1 for r in reports if r["opp_id"] not in SUBMITTED | SKIPPED | FUTURE and r.get("checks", {}).get(check_key) is True)

    master_lines += [
        "",
        f"## Active-app pass rates (n={total_apps})",
        "",
        f"- Weighted gap: {count_pass('weighted_gap')}/{total_apps}",
        f"- Supervisor inquiry email: {count_pass('supervisor_inquiry')}/{total_apps}",
        f"- Referee brief Ammar: {count_pass('referee_brief_ammar')}/{total_apps}",
        f"- Referee brief Viktor: {count_pass('referee_brief_viktor')}/{total_apps}",
        f"- RS cites ≥3 supervisor papers: {count_pass('rs_supervisor_cites_pass')}/{total_apps}",
        f"- RS Mermaid diagram: {count_pass('rs_mermaid_diagram')}/{total_apps}",
        f"- RS 3-year workplan: {count_pass('rs_3yr_workplan')}/{total_apps}",
        f"- CL cites ≥1 supervisor paper: {count_pass('cl_supervisor_cite_pass')}/{total_apps}",
    ]

    out_dir = PHD_APPS / "_portal_recon"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "PLAYBOOK_MASTER.md").write_text("\n".join(master_lines) + "\n", encoding="utf-8")
    print("\n".join(master_lines))


if __name__ == "__main__":
    main()
