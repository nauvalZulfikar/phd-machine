"""One-off: regenerate the ## References section of a research_statement.md
with field-appropriate papers, given supervisor + themes. Surgical replacement."""

from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path
import yaml
from dotenv import load_dotenv
from openai import OpenAI

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")

PROMPT = """You are generating ONLY the bibliographic References section (Harvard style, numbered list) for a PhD research statement.

Constraints:
- Output ONLY the References list. No header, no commentary, no introduction.
- 10-12 entries, numbered "1. " ... "12. ".
- ≥3 entries must be REAL papers by the named supervisor (use ≥90% confidence; if unsure, write `[TODO: verify on Google Scholar — <Supervisor surname>]` instead of inventing a specific title).
- 5-7 entries must be CANONICAL papers in the supervisor's exact subfield (the themes given).
- Zero papers from unrelated fields (e.g. transport / VRP / digital twin for cities — these are NEVER appropriate unless the field IS transport).
- Use British English. Use real conference/journal venues (NeurIPS, ICLR, ICML, ACL, EMNLP, NAACL, AAAI, TACL, COLM, etc.).

Output format example:
1. Surname, F. et al. (2023). *Title.* Venue.
2. ...
"""


def fix(app_dir: Path):
    req = json.loads((app_dir / "REQUIREMENTS.json").read_text(encoding="utf-8"))
    rs = app_dir / "drafts" / "research_statement.md"
    if not rs.exists():
        rs = app_dir / "drafts" / "research_proposal.md"
    if not rs.exists():
        print(f"  no RS for {app_dir.name}")
        return

    md = rs.read_text(encoding="utf-8")
    # Split at "## References" header (case-insensitive)
    m = re.search(r"^##\s*References\s*$", md, re.IGNORECASE | re.MULTILINE)
    if not m:
        print(f"  no References section in {app_dir.name}")
        return
    head = md[:m.end()]  # keep up to and including the "## References" line
    print(f"\n[fix-refs] {app_dir.name}")
    print(f"  supervisor: {req.get('supervisor')}")
    print(f"  themes: {', '.join(req.get('research_themes', []))[:80]}")

    client = OpenAI()
    sys_msg = PROMPT + f"\n\n## Supervisor: {req.get('supervisor')}\n## Themes: {', '.join(req.get('research_themes', []))}\n## Institution: {req.get('institution')}"
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": f"Generate the References section for a PhD application to this supervisor and field."},
        ],
        temperature=0.2,
    )
    new_refs = resp.choices[0].message.content.strip()
    new_refs = re.sub(r"^```(?:markdown|md)?\s*\n", "", new_refs)
    new_refs = re.sub(r"\n```\s*$", "", new_refs)

    new_md = head + "\n\n" + new_refs + "\n"
    rs.write_text(new_md, encoding="utf-8")
    print(f"  wrote {len(new_refs)} chars")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("app_dirs", nargs="+")
    args = ap.parse_args()
    for d in args.app_dirs:
        fix(Path(d).resolve())


if __name__ == "__main__":
    main()
