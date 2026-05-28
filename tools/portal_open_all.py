"""Open all PhD application portals in one headed Chromium session, multi-tab.

For each portal:
  - Open in a new tab
  - Dismiss cookies
  - Screenshot
  - For UKP (the only directly-fillable form): autofill all known fields
  - For applykite Aalborg: detect & attempt autofill
  - For all others: detect login wall / portal redirect / blocker
  - Print short non-tech report per tab

Leaves the browser open so user can finish manually.

Usage:
    python tools/portal_open_all.py
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError, Page

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
PHD_APPS = REPO_ROOT.parent / "phd-applications"
PROFILE = yaml.safe_load((REPO_ROOT / "data/knowledge/profile.yaml").read_text(encoding="utf-8"))
PERSONAL = PROFILE.get("personal", {})

# (opp_id, url, tier)  tier ∈ {fillable, login-wall, info-only, email-only, not-open}
PORTALS = [
    ("ukp-intertext",              "https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment", "fillable"),
    ("aalborg-llm-security",       "https://www.applykite.com/positions/fully-funded-phd-positions-in-natural-language-processing-ai-and-llm-security-at-aalborg-university-copenhagen-7rqf3l1190", "try-fillable"),
    ("copenhagen-mechinterp",      "https://employment.ku.dk/phd/?show=160571", "login-wall"),
    ("aarhus-tta",                 "https://phd.tech.au.dk/for-applicants/apply-here/saeropslag/phd-position-in-test-time-adaptation-and-agentic-ai", "login-wall"),
    ("chalmers-agentic-monitoring","https://academicpositions.com/ad/chalmers-university-of-technology/2026/doctoral-student-in-intentional-monitoring-of-agentic-ai-software/248516", "info-only"),
    ("leiden-formal-nlp",          "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing", "try-fillable"),
    ("polimi-pierri",              "https://www.polimi.it/en/phd/prospective-phd-candidates/admission/calls-and-open-positions/", "not-open"),
    ("cambridge-llm-safety",       "https://forms.gle/Cm3MWPsWta73J2Gp7", "login-wall"),
    ("tel-aviv-cs",                "https://en-exact-sciences.tau.ac.il/computer/phd", "info-only"),
    ("saarland-hahn",              "https://lacoco-lab.github.io/joining/", "email-only"),
    ("tubingen-andriushchenko",    "https://www.andriushchenko.me/", "email-only"),
    ("bar-ilan-goldberg",          "https://www.biu.ac.il/en/research-fellows/yoav-goldberg", "email-only"),
]

COOKIE_TEXTS = [
    "Accept all", "Accept All", "Accept", "Agree", "I agree", "OK",
    "Allow all", "Tillad alle", "Acceptér", "Acceptér alle", "Godkend",
    "Accetta", "Accetta tutti", "Alle akzeptieren", "Akzeptieren",
    "Zustimmen", "Tout accepter", "Aceptar todas", "Got it",
    "Accept All Cookies", "Allow all cookies",
]

UKP_AUTOFILL = {
    # CSS selector / name → value
    'input[name="givenName"]': "Nauval",
    'input[name="firstName"]': "Nauval",
    'input[name="given-name"]': "Nauval",
    'input[name="familyName"]': "Zulfikar",
    'input[name="lastName"]': "Zulfikar",
    'input[name="surname"]': "Zulfikar",
    'input[name="family-name"]': "Zulfikar",
    'input[name="email"]': PERSONAL.get("email", ""),
    'input[type="email"]': PERSONAL.get("email", ""),
    'input[name="phone"]': PERSONAL.get("phone_uk", ""),
    'input[type="tel"]': PERSONAL.get("phone_uk", ""),
    'input[name="city"]': "Bandung",
    'input[name="residenceCountry"]': "Indonesia",
    'input[name="citizenshipCountry"]': "Indonesia",
    'input[name="mscUniversity"]': "Aston University",
    'input[name="mscYear"]': "2024",
    'input[name="mscTitle"]': (
        "Enhancing Supply Chain Information Sharing Systems Through Blockchain: "
        "Integrated Customer Reviews LLM Analysis (DeBERTa-v3)"
    ),
}

GENERIC_AUTOFILL = {
    # Generic name fields likely to appear
    'input[id*="first" i]': "Nauval",
    'input[id*="given" i]': "Nauval",
    'input[id*="last" i]': "Zulfikar",
    'input[id*="family" i]': "Zulfikar",
    'input[id*="surname" i]': "Zulfikar",
    'input[id*="email" i]': PERSONAL.get("email", ""),
    'input[id*="phone" i]': PERSONAL.get("phone_uk", ""),
}


def dismiss_cookies(page: Page) -> str | None:
    for txt in COOKIE_TEXTS:
        try:
            loc = page.get_by_role("button", name=txt, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=1500)
                return txt
        except Exception:
            pass
    return None


def autofill(page: Page, mapping: dict[str, str]) -> list[str]:
    filled = []
    for selector, value in mapping.items():
        if not value:
            continue
        try:
            loc = page.locator(selector)
            if loc.count() > 0:
                el = loc.first
                if el.is_visible(timeout=500):
                    el.fill(value, timeout=2000)
                    filled.append(f"{selector} = {value[:30]}")
        except Exception:
            continue
    return filled


def signals(page: Page) -> dict:
    def cnt(sel):
        try: return page.locator(sel).count()
        except Exception: return 0
    return {
        "login": cnt("input[type='password']") + cnt("a[href*='login' i]"),
        "captcha": cnt("iframe[src*='recaptcha']") + cnt("iframe[src*='hcaptcha']") + cnt("iframe[title*='Cloudflare' i]"),
        "text_inputs": cnt("input[type='text']") + cnt("input:not([type])"),
        "file_inputs": cnt("input[type='file']"),
        "selects": cnt("select"),
        "textareas": cnt("textarea"),
    }


def process_tab(page: Page, opp_id: str, url: str, tier: str) -> dict:
    out_dir = PHD_APPS / opp_id / "portal_recon"
    out_dir.mkdir(parents=True, exist_ok=True)

    rep = {"opp_id": opp_id, "tier": tier, "url": url, "final_url": None,
           "title": None, "cookie": None, "filled": [], "blocker": None, "screenshot": None}

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except PWTimeoutError:
        pass
    try:
        page.wait_for_load_state("networkidle", timeout=6000)
    except PWTimeoutError:
        pass

    rep["final_url"] = page.url
    try: rep["title"] = page.title()
    except Exception: pass

    time.sleep(0.4)
    rep["cookie"] = dismiss_cookies(page)
    time.sleep(0.8)

    sig = signals(page)

    # Autofill attempt
    if tier in ("fillable", "try-fillable"):
        if opp_id == "ukp-intertext":
            rep["filled"] = autofill(page, UKP_AUTOFILL)
        else:
            rep["filled"] = autofill(page, GENERIC_AUTOFILL)

    # Blocker detection
    if tier == "not-open":
        rep["blocker"] = "Call cycle belum buka (PoliMi 41st cycle, expected June 2026)"
    elif tier == "email-only":
        rep["blocker"] = "Tidak ada portal — apply via email langsung"
    elif sig["login"] > 0 and not rep["filled"]:
        rep["blocker"] = f"Login wall ({sig['login']} login element terdeteksi) — butuh buat akun manual"
    elif sig["captcha"] > 0:
        rep["blocker"] = "CAPTCHA terdeteksi — butuh interaksi manual"
    elif tier == "info-only":
        rep["blocker"] = "Halaman info / job description doang — Apply button mungkin di tempat lain"
    elif sig["text_inputs"] == 0 and sig["selects"] == 0 and not rep["filled"]:
        rep["blocker"] = "Tidak ada form field visible di halaman ini"
    elif rep["filled"]:
        rep["blocker"] = f"Partial autofill OK — {len(rep['filled'])} field terisi; sisanya butuh manual (DOB/postal/gender/upload/dropdown)"
    else:
        rep["blocker"] = "Status unclear — review screenshot"

    rep["signals"] = sig

    # Screenshot
    try:
        shot = out_dir / "30_after_autofill.png"
        page.screenshot(path=str(shot), full_page=True)
        rep["screenshot"] = str(shot.relative_to(PHD_APPS))
    except Exception as e:
        rep["screenshot"] = f"failed: {e}"

    return rep


def main():
    print(f"[portal-open-all] launching headed Chromium with {len(PORTALS)} tabs...", flush=True)
    print(flush=True)

    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--ignore-certificate-errors", "--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            ignore_https_errors=True,
            viewport={"width": 1366, "height": 900},
        )

        for i, (opp_id, url, tier) in enumerate(PORTALS):
            page = context.new_page() if i > 0 else context.pages[0] if context.pages else context.new_page()
            print(f"[{i+1:2d}/{len(PORTALS)}] {opp_id}  ({tier})", flush=True)
            try:
                rep = process_tab(page, opp_id, url, tier)
            except Exception as e:
                rep = {"opp_id": opp_id, "tier": tier, "url": url, "blocker": f"ERROR: {type(e).__name__}: {e}"}
            reports.append(rep)
            shown_blocker = rep.get("blocker", "—")
            shown_filled = f" [filled={len(rep.get('filled', []))}]" if rep.get("filled") else ""
            print(f"      → {shown_blocker}{shown_filled}", flush=True)

        # Write master report
        master_md = PHD_APPS / "_portal_recon" / "OPEN_ALL_REPORT.md"
        master_md.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Portal Open-All Report",
            "",
            f"Generated by `tools/portal_open_all.py` — opened {len(PORTALS)} tabs in one Chromium session.",
            "",
            "| # | Opp | Tier | Filled | Blocker |",
            "|---|---|---|---|---|",
        ]
        for i, r in enumerate(reports):
            filled_n = len(r.get("filled", []))
            lines.append(f"| {i+1} | {r['opp_id']} | {r['tier']} | {filled_n} | {r.get('blocker','—')} |")

        lines += ["", "## Filled details (UKP / Aalborg / Leiden)", ""]
        for r in reports:
            if r.get("filled"):
                lines.append(f"### {r['opp_id']}")
                for f in r["filled"]:
                    lines.append(f"- `{f}`")
                lines.append("")

        master_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\n[portal-open-all] report → {master_md}", flush=True)
        print(f"[portal-open-all] screenshots → phd-applications/<opp>/portal_recon/30_after_autofill.png", flush=True)
        print(f"\n>>> BROWSER TETAP KEBUKA. Tutup window manual kalau udah selesai.", flush=True)
        print(f">>> Atau kill task '{__file__}' di Claude Code untuk close.", flush=True)
        # Block forever (browser stays open). User closes browser window manually,
        # OR TaskStop kills this process.
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n[portal-open-all] interrupted, closing browser...", flush=True)
            browser.close()


if __name__ == "__main__":
    main()
