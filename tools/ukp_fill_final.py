"""Final UKP autofill — opens JUST UKP portal in a fresh persistent browser
with ALL 16 fields filled including the new PII. Attaches combined PDF.
Stops at submit. Browser stays open for user to click Submit.
"""
from __future__ import annotations
import sys, time
from pathlib import Path
import yaml
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
PHD_APPS = REPO_ROOT.parent / "phd-applications"
PROFILE = yaml.safe_load((REPO_ROOT / "data/knowledge/profile.yaml").read_text(encoding="utf-8"))
P = PROFILE["personal"]

UKP_URL = "https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment"
COMBINED_PDF = PHD_APPS / "ukp-intertext" / "documents" / "UKP_combined_application.pdf"


FIELD_MAP = [
    # (CSS selector candidates, value, label-for-log)
    (['input[name="givenName"]', 'input[name="firstName"]', 'input[id*="first" i]'], "Nauval", "first name"),
    (['input[name="familyName"]', 'input[name="lastName"]', 'input[id*="last" i]', 'input[id*="surname" i]'], "Zulfikar", "last name"),
    (['input[name="birthDate"]', 'input[type="date"]', 'input[name*="birth" i]', 'input[id*="birth" i]'], P["date_of_birth"], "DOB"),
    (['input[name="address"]', 'input[name="street"]', 'input[id*="street" i]', 'input[id*="addr" i]'], P["address_street"], "address"),
    (['input[name="postalCode"]', 'input[name="zip"]', 'input[id*="postal" i]', 'input[id*="zip" i]'], P["address_postcode"], "postal code"),
    (['input[name="city"]', 'input[id*="city" i]'], P["address_city"], "city"),
    (['input[name="residenceCountry"]', 'input[id*="residence" i]', 'input[id*="country" i]'], P["address_country"], "residence country"),
    (['input[name="citizenshipCountry"]', 'input[id*="citizen" i]', 'input[id*="nationality" i]'], P["citizenship"], "citizenship"),
    (['input[name="email"]', 'input[type="email"]'], P["email"], "email"),
    (['input[name="phone"]', 'input[type="tel"]', 'input[id*="phone" i]'], P["phone_uk"], "phone"),
    (['input[name="mscTitle"]', 'input[id*="title" i]'], "Enhancing Supply Chain Information Sharing Systems Through Blockchain: Integrated Customer Reviews LLM Analysis (DeBERTa-v3)", "MSc title"),
    (['input[name="mscUniversity"]', 'input[id*="universit" i]'], "Aston University", "MSc university"),
    (['input[name="mscYear"]', 'input[id*="year" i]'], "2024", "MSc year"),
]

SELECT_MAP = [
    (['select[name="gender"]', 'select[id*="gender" i]'], ["Male", "male", "M"], "gender"),
    (['select[name="ukpPosition"]', 'select[id*="position" i]'], ["InterText", "PhD", "intertext"], "position"),
]


def try_fill(page, selectors, value):
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                el = loc.first
                if el.is_visible(timeout=600):
                    el.fill(value, timeout=2000)
                    return True, sel
        except Exception:
            continue
    return False, None


def try_select(page, selectors, candidates):
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                el = loc.first
                if el.is_visible(timeout=600):
                    for cand in candidates:
                        try:
                            el.select_option(label=cand, timeout=1500)
                            return True, f"{sel}={cand}"
                        except Exception:
                            try:
                                el.select_option(value=cand, timeout=1500)
                                return True, f"{sel}={cand}"
                            except Exception:
                                continue
        except Exception:
            continue
    return False, None


def try_attach(page, pdf_path: Path):
    selectors = ['input[type="file"]', 'input[name="attachments"]', 'input[name*="file" i]']
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                el = loc.first
                el.set_input_files(str(pdf_path), timeout=5000)
                return True, sel
        except Exception:
            continue
    return False, None


def main():
    print(f"[ukp-final] launching headed Chromium → opening UKP portal only...", flush=True)
    print(f"           combined PDF: {COMBINED_PDF.name} ({COMBINED_PDF.stat().st_size/1024:.0f} KB)", flush=True)
    print(flush=True)

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
        page = context.new_page()

        try:
            page.goto(UKP_URL, wait_until="domcontentloaded", timeout=30000)
        except PWTimeoutError:
            pass
        try:
            page.wait_for_load_state("networkidle", timeout=8000)
        except PWTimeoutError:
            pass

        time.sleep(1)
        # Dismiss cookies if any
        for txt in ["Accept all", "Accept", "Alle akzeptieren", "Zustimmen", "OK", "I agree"]:
            try:
                loc = page.get_by_role("button", name=txt, exact=False)
                if loc.count() > 0:
                    loc.first.click(timeout=1500)
                    time.sleep(0.5)
                    print(f"  cookies: dismissed '{txt}'", flush=True)
                    break
            except Exception:
                pass

        time.sleep(1.5)

        # Fill text/date fields
        print("\n=== Text/date fields ===", flush=True)
        for selectors, value, label in FIELD_MAP:
            ok, sel = try_fill(page, selectors, value)
            mark = "✅" if ok else "❌"
            print(f"  {mark} {label}: {value[:50]}  via {sel}", flush=True)

        # Select dropdowns
        print("\n=== Dropdowns ===", flush=True)
        for selectors, candidates, label in SELECT_MAP:
            ok, info = try_select(page, selectors, candidates)
            mark = "✅" if ok else "❌"
            print(f"  {mark} {label}  → {info or 'none matched'}", flush=True)

        # File upload
        print("\n=== File upload ===", flush=True)
        ok, sel = try_attach(page, COMBINED_PDF)
        mark = "✅" if ok else "❌"
        print(f"  {mark} attachment: {sel or 'no file input found'}", flush=True)

        # Screenshot final state
        time.sleep(1.5)
        shot = PHD_APPS / "ukp-intertext" / "portal_recon" / "99_final_filled.png"
        shot.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(shot), full_page=True)
        print(f"\n  → screenshot: {shot.relative_to(PHD_APPS)}", flush=True)

        print(f"\n>>> UKP TAB SIAP DI-REVIEW.", flush=True)
        print(f">>> Browser tetap kebuka. Scroll & verify, klik Submit kalo udah OK.", flush=True)
        print(f">>> Tutup window-nya manual atau kill task untuk close.", flush=True)

        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            print("\n[ukp-final] interrupted.", flush=True)
            browser.close()


if __name__ == "__main__":
    main()
