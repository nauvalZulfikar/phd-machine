"""Aston-playbook pack — per-app orchestrator.

Generates the FULL playbook bundle per app:
  1. WEIGHTED_GAP.md     — JD vs profile scoring
  2. drafts/supervisor_inquiry_email.md   — personalised inquiry to supervisor
  3. drafts/referee_brief_ammar.md        — brief for Dr. Ammar Al-Bazi
  4. drafts/referee_brief_viktor.md       — brief for Dr. Viktor Pekar

This script does NOT re-run the standard CV/CL/RS pipeline — assume draft.py + build_pdfs.py
already done OR run them separately. This adds the *playbook-specific* artifacts.

Usage:
    python tools/playbook_pack.py <opp-id-or-app-dir>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from openai import OpenAI

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = REPO_ROOT / "data" / "knowledge"
APPS_DIR = REPO_ROOT / "data" / "academic" / "apps"
load_dotenv(REPO_ROOT / ".env")


SUPERVISOR_INQUIRY_PROMPT = """Generate a SHORT (≤300 words) prospective-PhD inquiry email from Nauval Zulfikar to the supervisor named in REQUIREMENTS.json.

Structure:
- **To:** <supervisor name + email>
- **Subject:** Prospective PhD applicant — <one-line interest area> — Nauval Zulfikar (MSc Aston, 1:1)

Body in 4 short paragraphs:
1. **Self-intro** (2 sentences): MSc Aston 1:1, Aston Enterprise Scholar, dissertation topic 1-line.
2. **Why this lab** (3-4 sentences): cite ≥1 SPECIFIC paper by the supervisor from 2022-2025 by title. If no real title known with ≥90% confidence, write `[TODO: verify supervisor paper title on Google Scholar]`. Mention 1 specific theme from REQUIREMENTS.research_themes.
3. **What I bring** (2-3 sentences): name 2 most-relevant prior projects from USER PROFILE.projects.research_relevant whose `relevance_themes` overlap supervisor's themes.
4. **The ask** (1-2 short sentences): are they taking PhD students for next cycle, and may you send a short research-fit note before formal submission. Sign-off with contact line.

British English. No exclamation marks. No filler ("I am writing to express my keen interest"). Direct, evidence-led tone.
"""

REFEREE_BRIEF_PROMPT = """Generate a 1-page Referee Brief in Markdown — addressed to the named referee, requesting they write a reference letter for Nauval Zulfikar's PhD application to the specific institution in REQUIREMENTS.json.

This is NOT a cover letter or pitch; it is a CONCISE briefing document so the referee can write a SPECIFIC, application-tailored letter (per Aston playbook).

Structure:
- **To:** <Referee name + email + their relationship to Nauval>
- **Application target:** <institution + programme + supervisor + deadline>

Sections:
1. **What this PhD is about** (2 sentences) — extracted from REQUIREMENTS.research_themes + supervisor focus.
2. **Why Nauval is applying** (2 sentences) — match between PROFILE.projects.research_relevant and supervisor themes.
3. **Specific traits to highlight** (3-4 bullet points) — pick traits the referee personally observed:
   - For Ammar: dissertation methodology + DeBERTa-v3 work + supply-chain LLM analysis + 1:1 grade
   - For Viktor: MSc personal-tutor relationship + Machine Learning for Business Analytics + Research Methods modules + class engagement
4. **Suggested project mentions** — 2-3 projects from PROFILE.projects.research_relevant the referee saw or knows about, with brief context.
5. **Deadline & how to submit** — when they should send (3 days before app deadline at latest), and where (typically directly via the institution's referee portal, or to Nauval to forward).

Length: ≤1 page. British English. Professional tone — Nauval is asking for a favour but giving the referee everything they need to write a strong, specific letter.
"""


WEIGHTED_GAP_PROMPT = """Generate a weighted gap analysis for this PhD application, matching Aston playbook style.

Output a Markdown document with this structure:

# Weighted Gap Analysis — <opp_id>

**Date:** 2026-05-21
**Target:** <institution> — <programme>
**Deadline:** <YYYY-MM-DD>

## 1. JD requirements (from REQUIREMENTS.json)

### Essential
<list eligibility items + research_themes>

### Desirable
<infer from research_themes second-tier or notes>

## 2. Profile scoring vs JD

Table with columns: Criterion | Weight (%) | Current fit (0-100) | Notes/evidence

Pick 8-12 criteria covering: academic credential, programming proficiency, NLP/ML domain depth, specific tools required (e.g. transformer-lens for mech interp, AnyLogic for sim, formal methods for type theory), publication record, supervisor-thematic alignment, language/visa.

Weights must sum to 100%.

## 3. Weighted current score: X%

## 4. Top 3 gaps + 2-day mini-build proposals

For each gap, propose a tight 1-2 day GitHub mini-build that would close it (e.g. for Copenhagen: "small transformer-lens activation-patching probe on Llama-3-8B-Instruct").

## 5. Target score after mini-build: Y%

Be specific, evidence-led, and conservative on scoring. Use USER PROFILE + REQUIREMENTS.json — no invention.
"""


def load_yaml() -> dict:
    p = KNOWLEDGE_DIR / "profile.yaml"
    return yaml.safe_load(p.read_text(encoding="utf-8")) or {}


def gen_doc(client: OpenAI, system: str, *, req: dict, profile: dict, model: str = "gpt-4o") -> str:
    user_msg = (
        "## POSITION (REQUIREMENTS.json)\n" + json.dumps(req, indent=2, ensure_ascii=False) +
        "\n\n## USER PROFILE\n" + yaml.safe_dump(profile, sort_keys=False)
    )
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )
    out = resp.choices[0].message.content.strip()
    out = re.sub(r"^```(?:markdown|md)?\s*\n", "", out)
    out = re.sub(r"\n```\s*$", "", out)
    return out


def pack(app_dir: Path):
    profile = load_yaml()
    req = json.loads((app_dir / "REQUIREMENTS.json").read_text(encoding="utf-8"))
    drafts = app_dir / "drafts"
    drafts.mkdir(exist_ok=True)
    client = OpenAI()

    print(f"\n[playbook-pack] {app_dir.name}")
    print(f"  supervisor: {req.get('supervisor')} <{req.get('supervisor_email')}>")

    # 1. Weighted gap analysis
    print("  - generating WEIGHTED_GAP.md ...", end=" ", flush=True)
    out = gen_doc(client, WEIGHTED_GAP_PROMPT, req=req, profile=profile)
    (app_dir / "WEIGHTED_GAP.md").write_text(out, encoding="utf-8")
    print(f"OK ({len(out)} chars)")

    # 2. Supervisor inquiry email
    if req.get("supervisor_email"):
        print("  - generating supervisor_inquiry_email.md ...", end=" ", flush=True)
        out = gen_doc(client, SUPERVISOR_INQUIRY_PROMPT, req=req, profile=profile)
        (drafts / "supervisor_inquiry_email.md").write_text(out, encoding="utf-8")
        print(f"OK ({len(out)} chars)")
    else:
        print("  - SKIP supervisor inquiry email (no supervisor_email in REQUIREMENTS)")

    # 3. Referee brief for Ammar
    print("  - generating referee_brief_ammar.md ...", end=" ", flush=True)
    ammar_system = REFEREE_BRIEF_PROMPT + "\n\n## Target referee: Dr. Ammar Al-Bazi (MSc dissertation supervisor; email a.al-bazi@aston.ac.uk)"
    out = gen_doc(client, ammar_system, req=req, profile=profile)
    (drafts / "referee_brief_ammar.md").write_text(out, encoding="utf-8")
    print(f"OK ({len(out)} chars)")

    # 4. Referee brief for Viktor
    print("  - generating referee_brief_viktor.md ...", end=" ", flush=True)
    viktor_system = REFEREE_BRIEF_PROMPT + "\n\n## Target referee: Dr. Viktor Pekar (MSc Personal Tutor; taught Machine Learning for Business Analytics + Research Methods modules; email v.pekar@aston.ac.uk)"
    out = gen_doc(client, viktor_system, req=req, profile=profile)
    (drafts / "referee_brief_viktor.md").write_text(out, encoding="utf-8")
    print(f"OK ({len(out)} chars)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("app_dir")
    args = ap.parse_args()
    p = Path(args.app_dir).resolve()
    if not (p / "REQUIREMENTS.json").exists():
        # Maybe just an opp-id
        p = APPS_DIR / args.app_dir
    pack(p)


if __name__ == "__main__":
    main()
