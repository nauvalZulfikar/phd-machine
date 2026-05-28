"""Read-only recon of PhD application portals.

For each (opp_id, url) pair: open page, take screenshot, detect login walls /
captchas / form fields, dump structure summary. NO data entry, NO clicks beyond
acceptance of cookie banners.

Output:
  phd-applications/<opp_id>/portal_recon/
    01_landing.png          — initial landing screenshot (full page)
    02_after_cookies.png    — after dismissing cookie banner (if any)
    structure.json          — detected form fields, login wall, file inputs
    BLOCKERS.md             — human-readable summary

Usage:
    python tools/portal_recon.py [--only <opp_id>]
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PHD_APPS = REPO_ROOT / "phd-applications"

# Portals known to require login first; we still screenshot the login screen.
PORTALS = [
    ("ukp-intertext",         "https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment"),
    ("copenhagen-mechinterp", "https://employment.ku.dk/phd/?show=160571"),
    ("aarhus-tta",            "https://phd.tech.au.dk/for-applicants/apply-here/saeropslag/phd-position-in-test-time-adaptation-and-agentic-ai"),
    ("chalmers-agentic-monitoring", "https://www.chalmers.se/en/about-chalmers/work-with-us/vacancies/"),
    ("polimi-pierri",         "https://www.polimi.it/en/phd/prospective-phd-candidates/admission/calls-and-open-positions/"),
    ("cambridge-llm-safety",  "https://forms.gle/Cm3MWPsWta73J2Gp7"),
    ("aalborg-llm-security",  "https://www.stillinger.aau.dk/vis-stilling/?vacancy=1410023"),
    # Saarland + Tübingen are direct-email pathways, no portal to recon
]


COOKIE_BUTTON_TEXTS = [
    "Accept all", "Accept All", "Accept",
    "Agree", "I agree", "OK",
    "Allow all", "Tillad alle", "Acceptér", "Acceptere", "Acceptér alle",
    "Godkend",
    "Accetta", "Accetta tutti",
    "Alle akzeptieren", "Akzeptieren", "Zustimmen",
    "Tout accepter",
    "Aceptar todas",
]


LOGIN_INDICATORS = [
    "input[type='password']",
    "input[name*='password' i]",
    "input[id*='password' i]",
    "input[name*='login' i]",
    "form[action*='login' i]",
    "form[action*='signin' i]",
    "a[href*='login' i]",
]

CAPTCHA_INDICATORS = [
    "iframe[src*='recaptcha']",
    "iframe[src*='hcaptcha']",
    "div.g-recaptcha",
    "iframe[title*='Cloudflare' i]",
    "div[class*='captcha' i]",
]

FILE_UPLOAD_INDICATORS = [
    "input[type='file']",
]

FORM_FIELD_INDICATORS = [
    "input[type='text']",
    "input[type='email']",
    "input[type='tel']",
    "input[type='date']",
    "textarea",
    "select",
]


def dismiss_cookies(page) -> str | None:
    """Try clicking common cookie-accept buttons. Return text of clicked button or None."""
    for txt in COOKIE_BUTTON_TEXTS:
        try:
            loc = page.get_by_role("button", name=txt, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=2000)
                return txt
        except PWTimeoutError:
            continue
        except Exception:
            continue
    # Fallback: try any element with text matching
    for txt in ["Accept all cookies", "Accept cookies"]:
        try:
            loc = page.get_by_text(txt, exact=False)
            if loc.count() > 0:
                loc.first.click(timeout=2000)
                return txt
        except Exception:
            continue
    return None


def count_selectors(page, selectors: list[str]) -> dict[str, int]:
    out = {}
    for s in selectors:
        try:
            out[s] = page.locator(s).count()
        except Exception:
            out[s] = 0
    return out


def recon_one(opp_id: str, url: str, headless: bool = True) -> dict:
    out_dir = PHD_APPS / opp_id / "portal_recon"
    out_dir.mkdir(parents=True, exist_ok=True)

    result = {
        "opp_id": opp_id,
        "url": url,
        "loaded": False,
        "title": None,
        "final_url": None,
        "cookie_dismissed": None,
        "login_wall_signals": {},
        "captcha_signals": {},
        "file_upload_inputs": 0,
        "form_fields": {},
        "error": None,
        "blockers": [],
    }

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(headless=headless, args=["--ignore-certificate-errors"])
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                           "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
                ignore_https_errors=True,
                viewport={"width": 1366, "height": 900},
            )
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except PWTimeoutError:
                # Soft-load; keep going
                pass
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except PWTimeoutError:
                pass

            result["loaded"] = True
            result["title"] = page.title()
            result["final_url"] = page.url

            # 01 landing screenshot
            page.screenshot(path=str(out_dir / "01_landing.png"), full_page=True)

            # Dismiss cookies
            time.sleep(0.5)
            clicked = dismiss_cookies(page)
            result["cookie_dismissed"] = clicked
            if clicked:
                time.sleep(1.5)
                page.screenshot(path=str(out_dir / "02_after_cookies.png"), full_page=True)

            # Sniff signals
            result["login_wall_signals"] = count_selectors(page, LOGIN_INDICATORS)
            result["captcha_signals"] = count_selectors(page, CAPTCHA_INDICATORS)
            result["form_fields"] = count_selectors(page, FORM_FIELD_INDICATORS)
            result["file_upload_inputs"] = sum(count_selectors(page, FILE_UPLOAD_INDICATORS).values())

            # Detect login wall
            login_total = sum(result["login_wall_signals"].values())
            captcha_total = sum(result["captcha_signals"].values())
            form_total = sum(result["form_fields"].values())

            if login_total > 0:
                result["blockers"].append(f"LOGIN-WALL: {login_total} login-related element(s) detected")
            if captcha_total > 0:
                result["blockers"].append(f"CAPTCHA: {captcha_total} captcha element(s) detected")
            if result["file_upload_inputs"] == 0 and "google" in url.lower():
                result["blockers"].append("NO-UPLOAD-IN-FORM: Google form may collect docs via separate channel")
            if form_total == 0 and login_total == 0:
                result["blockers"].append("PAGE-IS-DESCRIPTION-ONLY: no visible form fields — likely need to click 'apply' / 'next' link")

            browser.close()
        except Exception as e:
            result["error"] = f"{type(e).__name__}: {e}"

    (out_dir / "structure.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    # Human-readable blockers.md
    lines = [
        f"# Portal Recon — {opp_id}",
        "",
        f"**URL:** {url}",
        f"**Final URL:** {result['final_url'] or '(load failed)'}",
        f"**Page title:** {result['title'] or '—'}",
        f"**Cookie banner:** {('dismissed via ' + result['cookie_dismissed']) if result['cookie_dismissed'] else 'none / not dismissed'}",
        "",
        "## Signals",
        f"- Login-wall indicators: **{sum(result['login_wall_signals'].values())}**",
        f"- CAPTCHA indicators: **{sum(result['captcha_signals'].values())}**",
        f"- Form fields visible: **{sum(result['form_fields'].values())}**",
        f"- File-upload inputs: **{result['file_upload_inputs']}**",
        "",
        "## Blockers",
    ]
    if result["error"]:
        lines.append(f"- 🔴 ERROR loading page: `{result['error']}`")
    if result["blockers"]:
        for b in result["blockers"]:
            lines.append(f"- ⚠️ {b}")
    else:
        lines.append("- ✅ No automated blockers detected. Form may be fillable headed.")
    lines += [
        "",
        "## Recommended next step",
        "Open the URL above in a normal browser (logged in as Nauval), and use `phd-applications/<opp>/documents/*.pdf` to upload.",
        "Screenshots: `01_landing.png` (+ `02_after_cookies.png` if cookies present).",
    ]
    (out_dir / "BLOCKERS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None, help="recon only this opp_id")
    ap.add_argument("--headed", action="store_true", help="run with visible browser")
    args = ap.parse_args()

    targets = PORTALS
    if args.only:
        targets = [(o, u) for o, u in PORTALS if o == args.only]

    summary = []
    for opp_id, url in targets:
        print(f"\n[recon] {opp_id} → {url}")
        r = recon_one(opp_id, url, headless=not args.headed)
        sig_login = sum(r["login_wall_signals"].values())
        sig_capt = sum(r["captcha_signals"].values())
        sig_form = sum(r["form_fields"].values())
        sig_upl = r["file_upload_inputs"]
        if r["error"]:
            print(f"   🔴 ERROR: {r['error']}")
        else:
            print(f"   loaded={r['loaded']} login={sig_login} captcha={sig_capt} fields={sig_form} uploads={sig_upl} title={r['title']!r}")
        if r["blockers"]:
            for b in r["blockers"]:
                print(f"      ⚠️ {b}")
        summary.append(r)

    # Master summary
    master = PHD_APPS / "_portal_recon" / "MASTER_BLOCKERS.md"
    master.parent.mkdir(parents=True, exist_ok=True)
    mlines = ["# Portal Recon — Master Blockers", "", "| Opp | Login | CAPTCHA | Fields | Uploads | Blockers |", "|---|---|---|---|---|---|"]
    for r in summary:
        L = sum(r["login_wall_signals"].values())
        C = sum(r["captcha_signals"].values())
        F = sum(r["form_fields"].values())
        U = r["file_upload_inputs"]
        bcount = len(r["blockers"]) + (1 if r["error"] else 0)
        mlines.append(f"| [{r['opp_id']}](../{r['opp_id']}/portal_recon/BLOCKERS.md) | {L} | {C} | {F} | {U} | {bcount} |")
    master.write_text("\n".join(mlines) + "\n", encoding="utf-8")
    print(f"\n[recon] Master summary → {master}")


if __name__ == "__main__":
    main()
