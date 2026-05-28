"""Phase 3 GAP — diff REQUIREMENTS vs existing assets, decide reuse/build/skip.

Usage:
    python tools/gap.py <app-dir>

Output:
    <app-dir>/GAP.md             — human-readable
    <app-dir>/BUILD_CONFIG.yaml  — for build_pdfs.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import yaml

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
ASTON_DOCS = REPO_ROOT.parent / "phd_aston_prep" / "application" / "documents"
KNOWLEDGE_ASSETS = REPO_ROOT / "data" / "knowledge" / "assets"
DISSERTATION_PDF = KNOWLEDGE_ASSETS / "nauval_zulfikar_msc_dissertation_2024.pdf"

# thesis_abstract: prefer reusing full dissertation PDF if available, else build abstract
_thesis_plan = (
    {"action": "reuse", "source": str(DISSERTATION_PDF)}
    if DISSERTATION_PDF.exists()
    else {"action": "build", "kind": "full", "max_pages": 4, "title": "MSc Thesis Extended Abstract"}
)

# Map REQUIREMENTS doc enum → action plan
# action: reuse | build | skip | manual
DOC_PLAN = {
    "cv":                   {"action": "build", "kind": "cv",   "max_pages": 2, "title": "Curriculum Vitae"},
    "cover_letter":         {"action": "build", "kind": "full", "max_pages": 2, "title": "Cover Letter"},
    "research_statement":   {"action": "build", "kind": "full", "max_pages": 8, "title": "Research Statement"},
    "research_proposal":    {"action": "build", "kind": "full", "max_pages": 8, "title": "Research Proposal"},
    "personal_statement":   {"action": "build", "kind": "full", "max_pages": 4, "title": "Personal Statement"},
    "thesis_abstract":      _thesis_plan,
    "publication_list":     {"action": "build", "kind": "full", "max_pages": 2, "title": "Publication List"},
    "transcripts_bachelor": {"action": "reuse", "source": str(ASTON_DOCS / "nauval_zulfikar_bba_apu_transcript.pdf")},
    "transcripts_master":   {"action": "reuse", "source": str(ASTON_DOCS / "nauval_zulfikar_msc_aston_transcript.pdf")},
    "language_certificate": {"action": "reuse", "source": str(ASTON_DOCS / "nauval_zulfikar_ielts_2023.pdf")},
    "passport":             {"action": "reuse", "source": str(ASTON_DOCS / "nauval_zulfikar_passport.pdf")},
    "reference_letters":    {"action": "manual", "note": "Request from referees; Aston ref letters in phd_aston_prep/.../documents/"},
}


def pick_template(req: dict) -> str:
    """Heuristic: UK / ELLIS / generic European → uk-academic; US / strict-EU → default."""
    inst = (req.get("institution") or "").lower()
    if any(x in inst for x in ["mit", "stanford", "harvard", "cmu", "berkeley", "princeton"]):
        return "default"
    return "uk-academic"


def pick_filename_pattern(opp_id: str, institution: str | None) -> str:
    # opp-id is already a clean slug like "univie-5509"; use its first segment
    short = opp_id.split("-")[0].lower()
    return f"nauval_zulfikar_{short}_{{doc}}.pdf"


def analyze(req: dict, opp_id: str) -> tuple[str, dict]:
    """Return (gap_md, build_config_dict)."""
    required = req.get("required_docs", [])
    optional = req.get("optional_docs", [])
    page_limits = (req.get("constraints") or {}).get("page_limits") or {}

    reuse, build, manual, skip, unknown = [], [], [], [], []

    for doc in required:
        if doc.startswith("other:"):
            unknown.append(doc)
            continue
        plan = DOC_PLAN.get(doc)
        if plan is None:
            unknown.append(doc)
            continue
        entry = {"doc": doc, **plan}
        if plan["action"] == "reuse":
            reuse.append(entry)
        elif plan["action"] == "build":
            build.append(entry)
        elif plan["action"] == "manual":
            manual.append(entry)

    # Anything in Aston application not asked here is "skip"
    aston_only_docs = ["research_statement", "personal_statement"]
    for doc in aston_only_docs:
        if doc not in required and doc not in optional:
            skip.append(doc)

    # ─── BUILD_CONFIG ───
    template = pick_template(req)
    filename_pattern = pick_filename_pattern(opp_id, req.get("institution"))
    max_size_mb = (req.get("constraints") or {}).get("max_file_size_mb") or 5

    build_docs_yaml = []
    for b in build:
        d = {
            "name": b["doc"],
            "source": f"drafts/{b['doc']}.md",
            "kind": b["kind"],
            "title": b["title"],
        }
        max_p = page_limits.get(b["doc"]) or b.get("max_pages")
        if max_p:
            d["max_pages"] = max_p
        build_docs_yaml.append(d)

    build_config = {
        "template": template,
        "filename_pattern": filename_pattern,
        "max_file_size_mb": max_size_mb,
        "docs": build_docs_yaml,
    }

    # ─── GAP.md ───
    lines = [
        f"# Gap Analysis — {req.get('title', opp_id)}",
        f"",
        f"**Institution:** {req.get('institution')}",
        f"**Supervisor:** {req.get('supervisor')} <{req.get('supervisor_email')}>",
        f"**Deadline:** {req.get('deadline')}",
        f"**Template chosen:** `{template}`",
        f"",
        f"## REUSE (copy from existing files)",
        "",
    ]
    if reuse:
        for r in reuse:
            lines.append(f"- **{r['doc']}** ← `{r['source']}`")
    else:
        lines.append("_(none)_")

    lines += ["", "## BUILD (draft via draft.py, then PDF via build_pdfs.py)", ""]
    if build:
        for b in build:
            lines.append(f"- **{b['doc']}** ({b['title']}, {b['kind']}, max {b.get('max_pages', '?')} pages)")
    else:
        lines.append("_(none)_")

    lines += ["", "## MANUAL ACTION", ""]
    if manual:
        for m in manual:
            lines.append(f"- **{m['doc']}**: {m['note']}")
    else:
        lines.append("_(none)_")

    lines += ["", "## SKIP (Aston-only convention, not requested here)", ""]
    if skip:
        for s in skip:
            lines.append(f"- ~~{s}~~")
    else:
        lines.append("_(none)_")

    if unknown:
        lines += ["", "## UNKNOWN — REVIEW MANUALLY", ""]
        for u in unknown:
            lines.append(f"- ⚠️ `{u}` — not in known doc enum, handle manually")

    return "\n".join(lines) + "\n", build_config


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("app_dir")
    args = ap.parse_args()

    app_dir = Path(args.app_dir).resolve()
    req_path = app_dir / "REQUIREMENTS.json"
    if not req_path.exists():
        print(f"ERROR: {req_path} not found. Run scope.py first.")
        sys.exit(1)

    req = json.loads(req_path.read_text(encoding="utf-8"))
    gap_md, build_cfg = analyze(req, app_dir.name)

    (app_dir / "GAP.md").write_text(gap_md, encoding="utf-8")
    (app_dir / "BUILD_CONFIG.yaml").write_text(
        yaml.safe_dump(build_cfg, sort_keys=False, default_flow_style=False),
        encoding="utf-8",
    )

    print(f"[gap] Wrote {app_dir}/GAP.md")
    print(f"[gap] Wrote {app_dir}/BUILD_CONFIG.yaml")
    print(f"")
    print(gap_md)
    print(f"[gap] Next: python tools/draft.py {app_dir.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
