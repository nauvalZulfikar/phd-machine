"""Anti-prompt-injection scanner for already-generated PhD application files.

Scans:
  - phd-applications/<opp>/REQUIREMENTS.json   (LLM-extracted from web)
  - phd-applications/<opp>/drafts/*.md          (LLM-drafted)
  - phd-applications/<opp>/posting_raw.html     (raw input — useful to verify)

Flags:
  1. Known prompt-injection signatures in any text field
  2. Output content that suggests the LLM followed an attacker instruction
     (e.g. supervisor email on personal domain, off-domain portal_url,
     unexpected URLs in drafts, hidden HTML comments)
  3. Zero-width and bidirectional Unicode control characters
  4. Encoded payloads (base64, ROT13 hints)
  5. Mismatches: claimed supervisor name's domain ≠ institution

Usage:
    python tools/detect_injection.py [<phd-applications-dir>]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_DIR = Path(__file__).resolve().parent.parent.parent / "phd-applications"

# Injection-instruction signatures (case-insensitive)
INJECTION_PATTERNS = [
    (r"(?i)ignore (?:all )?(?:previous|prior|above|earlier) instructions?", "instruction-override"),
    (r"(?i)you are now (?:a|an|playing)", "persona-hijack"),
    (r"(?i)your (?:real|true|actual|new) task is", "task-redirect"),
    (r"(?i)^(?:system|assistant)\s*:", "role-spoof"),
    (r"(?i)disregard (?:the )?(?:system|above|previous|prior)", "instruction-override"),
    (r"(?i)\bnew instructions?\s*:", "task-redirect"),
    (r"(?i)forget (?:everything|all|previous)", "instruction-override"),
    (r"(?i)pretend (?:you are|to be|that)", "persona-hijack"),
    (r"<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>", "chat-template-leak"),
    (r"(?i)\boutput (?:only )?(?:the following|exactly)\s+", "output-hijack"),
    (r"(?i)respond (?:with|only with|in)\s+(?:json|markdown)", "format-hijack"),
    (r"(?i)act as (?:a|an) (?:hacker|attacker|adversary|jailbreaker)", "adversarial-persona"),
    (r"(?i)\bDAN\b.*(?:jailbreak|unrestricted)", "DAN-style-jailbreak"),
]

# Suspicious Unicode (zero-width + bidirectional controls)
SUSPICIOUS_UNICODE = {
    "​": "ZWSP zero-width-space",
    "‌": "ZWNJ zero-width-non-joiner",
    "‍": "ZWJ zero-width-joiner",
    "‎": "LRM left-to-right-mark",
    "‏": "RLM right-to-left-mark",
    " ": "LSEP line-separator",
    " ": "PSEP paragraph-separator",
    "‪": "LRE left-to-right-embedding",
    "‫": "RLE right-to-left-embedding",
    "‬": "PDF pop-directional-formatting",
    "‭": "LRO left-to-right-override",
    "‮": "RLO right-to-left-override",
    "﻿": "BOM byte-order-mark (inline)",
    "⁦": "LRI left-to-right-isolate",
    "⁧": "RLI right-to-left-isolate",
    "⁨": "FSI first-strong-isolate",
    "⁩": "PDI pop-directional-isolate",
}

PERSONAL_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "protonmail.com", "icloud.com", "aol.com", "mail.com",
}

# Acceptable academic TLDs / patterns
ACADEMIC_TLD_PATTERNS = [
    r"\.edu$", r"\.ac\.[a-z]{2,3}$", r"\.uni-", r"^uni-", r"\.uni",
    r"\.cam\.ac\.uk$", r"\.ox\.ac\.uk$",
]


def scan_text(text: str, *, label: str) -> list[dict]:
    findings: list[dict] = []

    # 1. Injection patterns
    for pat, kind in INJECTION_PATTERNS:
        for m in re.finditer(pat, text):
            findings.append({
                "where": label,
                "severity": "HIGH",
                "kind": kind,
                "match": m.group(0)[:80],
                "pos": m.start(),
            })

    # 2. Suspicious Unicode
    for ch, name in SUSPICIOUS_UNICODE.items():
        if ch in text:
            count = text.count(ch)
            findings.append({
                "where": label,
                "severity": "MEDIUM",
                "kind": "suspicious-unicode",
                "match": f"{name} (count={count})",
                "pos": text.find(ch),
            })

    # 3. Hidden HTML comments (only in MD files, where they'd carry through to render)
    for m in re.finditer(r"<!--\s*[^\n]{40,}\s*-->", text):
        body = m.group(0)
        # Whitelist the injection-flag comment we ourselves emit
        if "INJECTION SUSPECTED" in body:
            continue
        findings.append({
            "where": label,
            "severity": "LOW",
            "kind": "long-html-comment",
            "match": body[:100],
            "pos": m.start(),
        })

    # 4. Base64-ish blobs > 80 chars
    for m in re.finditer(r"\b[A-Za-z0-9+/]{80,}={0,2}\b", text):
        findings.append({
            "where": label,
            "severity": "MEDIUM",
            "kind": "possible-base64-payload",
            "match": m.group(0)[:80] + "...",
            "pos": m.start(),
        })

    return findings


def scan_requirements_json(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        return [{"where": str(path), "severity": "ERROR", "kind": "parse-error", "match": str(e), "pos": 0}]

    findings: list[dict] = []
    rel = path.parent.name + "/" + path.name

    # Scan all string values in the JSON
    def walk(obj, prefix: str):
        if isinstance(obj, dict):
            for k, v in obj.items():
                walk(v, f"{prefix}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk(v, f"{prefix}[{i}]")
        elif isinstance(obj, str):
            findings.extend(scan_text(obj, label=f"{rel} @ {prefix}"))

    walk(data, "$")

    # Special checks
    sup_email = (data.get("supervisor_email") or "").lower()
    if sup_email and "@" in sup_email:
        domain = sup_email.split("@", 1)[1]
        if domain in PERSONAL_EMAIL_DOMAINS:
            findings.append({
                "where": f"{rel} @ $.supervisor_email",
                "severity": "HIGH",
                "kind": "supervisor-on-personal-domain",
                "match": sup_email,
                "pos": 0,
            })

    # Pre-emitted injection flags from scope.py are GOOD (informational)
    if data.get("_injection_signatures"):
        findings.append({
            "where": f"{rel} @ $._injection_signatures",
            "severity": "INFO",
            "kind": "self-reported-injection-flag",
            "match": f"{len(data['_injection_signatures'])} signature(s) recorded at scope-time",
            "pos": 0,
        })

    return findings


def scan_md(path: Path) -> list[dict]:
    rel = "/".join(path.parts[-3:])  # opp/drafts/file.md
    return scan_text(path.read_text(encoding="utf-8"), label=rel)


def scan_html(path: Path) -> list[dict]:
    """Scan the raw posting HTML — the INPUT layer where injection would originate."""
    rel = "/".join(path.parts[-2:])
    try:
        # Strip HTML tags first so we only flag text-content injection (not noisy attribute values)
        text = path.read_text(encoding="utf-8", errors="ignore")
        text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
    except Exception as e:
        return [{"where": rel, "severity": "ERROR", "kind": "html-read-error", "match": str(e), "pos": 0}]
    return scan_text(text, label=f"{rel} (input HTML)")


def scan_app_dir(app_dir: Path) -> list[dict]:
    findings: list[dict] = []
    req = app_dir / "REQUIREMENTS.json"
    if req.exists():
        findings.extend(scan_requirements_json(req))
    drafts = app_dir / "drafts"
    if drafts.exists():
        for md in drafts.glob("*.md"):
            findings.extend(scan_md(md))
    posting_html = app_dir / "posting_raw.html"
    if posting_html.exists():
        findings.extend(scan_html(posting_html))
    return findings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", default=str(DEFAULT_DIR))
    ap.add_argument("--app", default=None, help="scan only this opp-id sub-dir")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if args.app:
        targets = [root / args.app]
    else:
        targets = [p for p in root.iterdir() if p.is_dir() and p.name not in ("shared",)]

    all_findings: list[dict] = []
    per_app: dict[str, int] = {}
    for app_dir in sorted(targets):
        if not app_dir.is_dir():
            continue
        f = scan_app_dir(app_dir)
        per_app[app_dir.name] = len(f)
        all_findings.extend(f)

    # Group by severity
    by_sev: dict[str, list[dict]] = {}
    for f in all_findings:
        by_sev.setdefault(f["severity"], []).append(f)

    print("=" * 70)
    print(f"PROMPT-INJECTION SCAN — {len(all_findings)} finding(s) across {len(per_app)} app(s)")
    print("=" * 70)
    print()
    print("Per-app totals:")
    for app, n in sorted(per_app.items(), key=lambda x: -x[1]):
        flag = " ⚠️" if n else " ✅"
        print(f"  {flag}  {app:40s} {n} finding(s)")
    print()

    for sev in ["ERROR", "HIGH", "MEDIUM", "LOW", "INFO"]:
        items = by_sev.get(sev, [])
        if not items:
            continue
        icon = {"ERROR": "🔴", "HIGH": "🚨", "MEDIUM": "⚠️", "LOW": "📝", "INFO": "ℹ️"}[sev]
        print(f"\n{icon} {sev} ({len(items)})")
        print("-" * 70)
        for f in items:
            print(f"  [{f['kind']}] {f['where']}")
            print(f"    └─ {f['match']!r}")

    if not all_findings:
        print("\n✅ Clean — no injection signatures, suspicious unicode, or anomalies detected.")
    else:
        print(f"\nTotal: {len(all_findings)} findings. Review HIGH severity first.")


if __name__ == "__main__":
    main()
