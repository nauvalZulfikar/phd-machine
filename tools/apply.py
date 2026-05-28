"""Orchestrator — runs scope → gap → draft → build_pdfs end-to-end.

Usage:
    python tools/apply.py <url>                  # full pipeline, interactive
    python tools/apply.py <url> --opp-id <id>    # custom opp-id
    python tools/apply.py --resume <app-dir>     # resume from gap (REQUIREMENTS already exists)
    python tools/apply.py --from build <app-dir> # rebuild PDFs only
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
APPS_DIR = REPO_ROOT / "data" / "academic" / "apps"

PHASES = ["scope", "gap", "draft", "build"]


def run(cmd: list[str]) -> int:
    print(f"\n{'═' * 70}\n>>> {' '.join(cmd)}\n{'═' * 70}")
    r = subprocess.run(cmd, cwd=REPO_ROOT)
    return r.returncode


def pause(msg: str):
    print(f"\n[pause] {msg}")
    print(f"[pause] Press ENTER to continue, Ctrl+C to stop (drafts are saved either way).")
    try:
        input()
    except EOFError:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url", nargs="?", help="posting URL (required for fresh run)")
    ap.add_argument("--opp-id", default=None)
    ap.add_argument("--resume", default=None, help="path to existing app dir, resume from gap")
    ap.add_argument("--from", dest="from_phase", default="scope", choices=PHASES,
                    help="start phase (when --resume given)")
    ap.add_argument("--noninteractive", action="store_true", help="skip pauses")
    args = ap.parse_args()

    if args.resume:
        app_dir = Path(args.resume).resolve()
        start_idx = PHASES.index(args.from_phase)
    elif args.url:
        # Phase 1: scope. opp-id and app_dir determined by scope.py
        cmd = [sys.executable, "tools/scope.py", args.url]
        if args.opp_id:
            cmd += ["--opp-id", args.opp_id]
        if run(cmd) != 0:
            sys.exit(1)
        # locate the just-created app dir (most recently modified under APPS_DIR)
        candidates = sorted(APPS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
        app_dir = candidates[0]
        start_idx = 1  # next = gap
    else:
        ap.print_help()
        sys.exit(1)

    rel = app_dir.relative_to(REPO_ROOT)

    if start_idx <= 1:
        if run([sys.executable, "tools/gap.py", str(rel)]) != 0:
            sys.exit(1)
        if not args.noninteractive:
            pause(f"Review {rel}/GAP.md and {rel}/BUILD_CONFIG.yaml. Edit if needed.")

    if start_idx <= 2:
        if run([sys.executable, "tools/draft.py", str(rel)]) != 0:
            sys.exit(1)
        if not args.noninteractive:
            pause(f"Review drafts in {rel}/drafts/. Edit MD files if needed.")

    if start_idx <= 3:
        if run([sys.executable, "tools/build_pdfs.py", str(rel)]) != 0:
            sys.exit(1)

    print(f"\n{'═' * 70}")
    print(f"DONE. Bundle at: {app_dir}/documents/")
    print(f"Next: review PDFs, then submit via portal at REQUIREMENTS.portal_url")
    print(f"{'═' * 70}")


if __name__ == "__main__":
    main()
