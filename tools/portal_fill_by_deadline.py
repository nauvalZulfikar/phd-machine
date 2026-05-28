"""Open all remaining PhD portals (skip UKP — already open), in DEADLINE ORDER.

Tries autofill on each. For login-walled/email-only/VPN-blocked → reports.
Browser stays open for user to handle account creation + manual upload.

Order:
  1. Copenhagen     31 May 2026  (login wall)
  2. Tel Aviv       31 May 2026  (VPN blocked)
  3. Aarhus         1  Jun 2026  (login wall)
  4. Chalmers       12 Jun 2026  (info → Varbi)
  5. Leiden         26 Jun 2026  (try-fillable)
  6. Cambridge      30 Jul 2026  (Google Forms login)
  7. Aalborg        31 Aug 2026  (try-fillable)
  8. PoliMi         TBD Jun      (not open)
  9. Saarland       rolling      (email)
 10. Tübingen       rolling      (email)
 11. Bar-Ilan       rolling      (VPN + email)
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import yaml
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError, Page

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
PHD_APPS = REPO_ROOT.parent / "phd-applications"
PROFILE = yaml.safe_load((REPO_ROOT / "data/knowledge/profile.yaml").read_text(encoding="utf-8"))
P = PROFILE["personal"]

# (opp_id, url, deadline, tier)
PORTALS = [
    ("copenhagen-mechinterp",      "https://employment.ku.dk/phd/?show=160571",                                                                                   "31 May 2026", "login-wall"),
    ("tel-aviv-cs",                "https://en-exact-sciences.tau.ac.il/computer/phd",                                                                            "31 May 2026", "vpn-blocked"),
    ("aarhus-tta",                 "https://phd.tech.au.dk/for-applicants/apply-here/saeropslag/phd-position-in-test-time-adaptation-and-agentic-ai",             "1 Jun 2026",  "login-wall"),
    ("chalmers-agentic-monitoring","https://academicpositions.com/ad/chalmers-university-of-technology/2026/doctoral-student-in-intentional-monitoring-of-agentic-ai-software/248516", "12 Jun 2026", "info-only"),
    ("leiden-formal-nlp",          "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing",                       "26 Jun 2026", "try-fillable"),
    ("cambridge-llm-safety",       "https://forms.gle/Cm3MWPsWta73J2Gp7",                                                                                          "30 Jul 2026", "google-form"),
    ("aalborg-llm-security",       "https://www.applykite.com/positions/fully-funded-phd-positions-in-natural-language-processing-ai-and-llm-security-at-aalborg-university-copenhagen-7rqf3l1190", "31 Aug 2026", "try-fillable"),
    ("polimi-pierri",              "https://www.polimi.it/en/phd/prospective-phd-candidates/admission/calls-and-open-positions/",                                  "TBD Jun 2026","not-open"),
    ("saarland-hahn",              "https://lacoco-lab.github.io/joining/",                                                                                        "rolling",     "email-only"),
    ("tubingen-andriushchenko",    "https://www.andriushchenko.me/",                                                                                                "rolling",     "email-only"),
    ("bar-ilan-goldberg",          "https://www.biu.ac.il/en/research-fellows/yoav-goldberg",                                                                       "rolling",     "vpn-blocked"),
]

COOKIE_TEXTS = [
    "Accept all", "Accept All", "Accept", "Agree", "I agree", "OK",
    "Allow all", "Tillad alle", "Acceptér", "Acceptér alle", "Godkend",
    "Accetta", "Accetta tutti", "Alle akzeptieren", "Akzeptieren",
    "Zustimmen", "Tout accepter", "Aceptar todas", "Got it",
    "Accept All Cookies", "Allow all cookies", "Allow", "Aceitar",
]

GENERIC_AUTOFILL = {
    'input[name="firstName"]':       "Nauval",
    'input[name="givenName"]':       "Nauval",
    'input[name="given-name"]':      "Nauval",
    'input[name="first_name"]':      "Nauval",
    'input[id*="first" i]':          "Nauval",
    'input[id*="given" i]':          "Nauval",

    'input[name="lastName"]':        "Zulfikar",
    'input[name="familyName"]':      "Zulfikar",
    'input[name="family-name"]':     "Zulfikar",
    'input[name="last_name"]':       "Zulfikar",
    'input[name="surname"]':         "Zulfikar",
    'input[id*="last" i]':           "Zulfikar",
    'input[id*="surname" i]':        "Zulfikar",

    'input[name="email"]':           P["email"],
    'input[type="email"]':           P["email"],
    'input[id*="email" i]':          P["email"],

    'input[name="phone"]':           P["phone_uk"],
    'input[type="tel"]':             P["phone_uk"],
    'input[id*="phone" i]':          P["phone_uk"],

    'input[name="city"]':            P["address_city"],
    'input[id*="city" i]':           P["address_city"],

    'input[name="address"]':         P["address_street"],
    'input[name="street"]':          P["address_street"],
    'input[id*="street" i]':         P["address_street"],
    'input[id*="addr" i]':           P["address_street"],

    'input[name="postalCode"]':      P["address_postcode"],
    'input[name="zip"]':             P["address_postcode"],
    'input[id*="postal" i]':         P["address_postcode"],
    'input[id*="zip" i]':            P["address_postcode"],

    'input[name="country"]':         P["address_country"],
    'input[name="residenceCountry"]':P["address_country"],
    'input[id*="country" i]':        P["address_country"],

    'input[name="nationality"]':     P["citizenship"],
    'input[name="citizenshipCountry"]':P["citizenship"],
    'input[id*="nationality" i]':    P["citizenship"],
    'input[id*="citizen" i]':        P["citizenship"],

    'input[name="dob"]':             P["date_of_birth"],
    'input[name="birthDate"]':       P["date_of_birth"],
    'input[name="dateOfBirth"]':     P["date_of_birth"],
    'input[type="date"]':            P["date_of_birth"],
    'input[id*="birth" i]':          P["date_of_birth"],
    'input[id*="dob" i]':            P["date_of_birth"],
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
    for sel, val in mapping.items():
        if not val:
            continue
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                el = loc.first
                if el.is_visible(timeout=400):
                    el.fill(val, timeout=1500)
                    filled.append(sel)
        except Exception:
            continue
    return filled


def signals(page: Page) -> dict:
    def cnt(sel):
        try: return page.locator(sel).count()
        except Exception: return 0
    return {
        "login":    cnt("input[type='password']") + cnt("a[href*='login' i]") + cnt("button:has-text('Sign in')") + cnt("button:has-text('Log in')"),
        "captcha":  cnt("iframe[src*='recaptcha']") + cnt("iframe[src*='hcaptcha']") + cnt("iframe[title*='Cloudflare' i]"),
        "inputs":   cnt("input[type='text']") + cnt("input:not([type])"),
        "files":    cnt("input[type='file']"),
        "selects":  cnt("select"),
    }


def process_tab(page: Page, opp_id: str, url: str, deadline: str, tier: str) -> dict:
    out_dir = PHD_APPS / opp_id / "portal_recon"
    out_dir.mkdir(parents=True, exist_ok=True)
    rep = {"opp_id": opp_id, "deadline": deadline, "tier": tier, "url": url,
           "final_url": None, "title": None, "filled": [], "blocker": None}

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except PWTimeoutError:
        pass
    except Exception as e:
        rep["blocker"] = f"NAVIGATION FAILED: {type(e).__name__} — kemungkinan VPN required"
        return rep

    try: page.wait_for_load_state("networkidle", timeout=5000)
    except PWTimeoutError: pass

    rep["final_url"] = page.url
    try: rep["title"] = page.title()
    except Exception: pass

    time.sleep(0.5)
    dismiss_cookies(page)
    time.sleep(0.8)

    sig = signals(page)

    if tier in ("try-fillable",):
        rep["filled"] = autofill(page, GENERIC_AUTOFILL)

    # Blocker assessment
    if tier == "vpn-blocked":
        rep["blocker"] = "VPN required: domain di-blokir ISP lo (Israel .ac.il)"
    elif tier == "not-open":
        rep["blocker"] = "Call belum buka — tunggu June 2026 (PoliMi cycle 41)"
    elif tier == "email-only":
        rep["blocker"] = "Email-only — kirim ke supervisor langsung (lihat drafts/)"
    elif tier == "google-form":
        rep["blocker"] = "Google Forms — login dengan Gmail dulu, lalu lo isi manual"
    elif tier == "info-only":
        rep["blocker"] = "Halaman info — klik 'Apply on company website' → bikin akun Varbi"
    elif sig["login"] > 0 and not rep["filled"]:
        rep["blocker"] = f"Login wall ({sig['login']} login element) — butuh bikin akun manual"
    elif sig["inputs"] == 0 and sig["selects"] == 0 and not rep["filled"]:
        rep["blocker"] = "Tidak ada form input visible (mungkin redirect ke job listing)"
    elif rep["filled"]:
        rep["blocker"] = f"PARTIAL AUTOFILL — {len(rep['filled'])} field; sisanya butuh manual (upload PDF, dropdowns)"
    else:
        rep["blocker"] = "Status unclear — cek screenshot"

    rep["signals"] = sig

    # Screenshot
    try:
        shot = out_dir / "31_deadline_pass.png"
        page.screenshot(path=str(shot), full_page=True)
        rep["screenshot"] = str(shot.relative_to(PHD_APPS))
    except Exception:
        pass

    return rep


def main():
    print(f"[deadline-pass] launching headed Chromium → {len(PORTALS)} tabs in deadline order...", flush=True)
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

        for i, (opp_id, url, deadline, tier) in enumerate(PORTALS):
            page = context.new_page() if i > 0 else context.pages[0] if context.pages else context.new_page()
            print(f"[{i+1:2d}/{len(PORTALS)}] {opp_id:<32}  dl={deadline:<13} tier={tier}", flush=True)
            try:
                rep = process_tab(page, opp_id, url, deadline, tier)
            except Exception as e:
                rep = {"opp_id": opp_id, "deadline": deadline, "tier": tier, "url": url,
                       "blocker": f"ERROR: {type(e).__name__}: {e}"}
            reports.append(rep)
            filled_s = f" [filled={len(rep.get('filled', []))}]" if rep.get("filled") else ""
            print(f"      → {rep.get('blocker','—')}{filled_s}", flush=True)

        # Write report
        out_md = PHD_APPS / "_portal_recon" / "DEADLINE_PASS_REPORT.md"
        out_md.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Deadline-Ordered Portal Pass",
            "",
            "Generated by `tools/portal_fill_by_deadline.py`. Tabs opened in order of closest deadline first (UKP skipped — handled separately by `ukp_fill_final.py`).",
            "",
            "| # | App | Deadline | Filled | Blocker |",
            "|---|---|---|---|---|",
        ]
        for i, r in enumerate(reports):
            n = len(r.get("filled", []))
            lines.append(f"| {i+1} | {r['opp_id']} | {r['deadline']} | {n} | {r.get('blocker','—')} |")
        out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"\n[deadline-pass] report → {out_md.relative_to(PHD_APPS)}", flush=True)

        print(f"\n>>> BROWSER TETAP KEBUKA — tab terurut deadline.", flush=True)
        print(f">>> Tab paling kiri = paling urgent. Mulai dari sana.", flush=True)
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            browser.close()


if __name__ == "__main__":
    main()
