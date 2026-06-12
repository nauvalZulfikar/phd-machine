#!/usr/bin/env python3
"""Deterministic headed form-filler for PhD application portals.

Human does login/CAPTCHA/fee (the part bots can't). This script auto-fills the
standard text fields from shared/profile.yaml, attaches CV/cover/research PDFs to
the right-looking upload slots, and STOPS at submit (never clicks it). Leaves the
visible browser open so the human can review + click submit.

Run:  .venv/python headed_filler.py <opp_folder> <portal_url>
Persistent profile per opp so a login sticks across runs.
"""
import sys, time, pathlib, re
from playwright.sync_api import sync_playwright

PHD = pathlib.Path.home() / "coding-projects" / "phd"
SHARED = PHD / "shared"

# --- canonical profile values (mirrors shared/profile.yaml) ---
P = {
    "full_name": "Nauval Zulfikar",
    "first_name": "Nauval",
    "last_name": "Zulfikar",
    "email": "zulfikar.nauval1998@gmail.com",
    "phone": "+44 7300 469048",
    "city": "Bandung",
    "country": "Indonesia",
    "nationality": "Indonesian",
    "linkedin": "https://www.linkedin.com/in/nauval-zulfikar",
    "github": "https://github.com/nauvalZulfikar",
    "portfolio": "https://nauvalzulfikar.vercel.app",
}

# label/name keyword -> profile key
TEXT_MAP = [
    (r"first.?name|given.?name|voornaam|nome", "first_name"),
    (r"last.?name|surname|family.?name|achternaam|cognome", "last_name"),
    (r"full.?name|your name|naam|^name$", "full_name"),
    (r"e.?mail", "email"),
    (r"phone|mobile|tel|telefoon|telefono", "phone"),
    (r"nationalit", "nationality"),
    (r"city|town|woonplaats|citt", "city"),
    (r"country|land|paese", "country"),
    (r"linkedin", "linkedin"),
    (r"github", "github"),
    (r"portfolio|website|personal.?page", "portfolio"),
]

def opp_docs(opp):
    d = PHD / "in-process" / opp / "documents"
    if not d.exists():
        d = PHD / "missed" / opp / "documents"
    pdfs = sorted(d.glob("*.pdf")) if d.exists() else []
    return d, pdfs

def field_keyword(page, el):
    """Best-effort label text for an input: aria-label, placeholder, name, id, or <label for>."""
    parts = []
    for attr in ("aria-label", "placeholder", "name", "id"):
        v = el.get_attribute(attr) or ""
        parts.append(v)
    fid = el.get_attribute("id")
    if fid:
        lab = page.query_selector(f"label[for='{fid}']")
        if lab:
            parts.append(lab.inner_text())
    return " ".join(parts).lower()

def main():
    opp = sys.argv[1] if len(sys.argv) > 1 else "leiden-formal-nlp"
    url = sys.argv[2] if len(sys.argv) > 2 else \
        "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
    recon = PHD / ("in-process" if (PHD/"in-process"/opp).exists() else "missed") / opp / "portal_recon"
    recon.mkdir(parents=True, exist_ok=True)
    profile_dir = PHD / ".browser-profiles" / opp
    profile_dir.mkdir(parents=True, exist_ok=True)
    docs_dir, pdfs = opp_docs(opp)
    print(f"[opp] {opp}\n[url] {url}\n[docs] {len(pdfs)} pdf(s) in {docs_dir}")

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir), headless=False,
            viewport={"width": 1400, "height": 950},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        print("[nav] loaded. If a cookie banner / login / Apply button appears, "
              "handle login yourself. I will poll for form fields and fill them.")

        # poll up to 5 min for a fillable form to appear (after human passes login)
        filled = 0
        deadline = time.time() + 300
        seen_inputs = set()
        while time.time() < deadline:
            inputs = page.query_selector_all(
                "input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea")
            for el in inputs:
                try:
                    if not el.is_visible():
                        continue
                    key = el.get_attribute("name") or el.get_attribute("id") or repr(el)
                    if key in seen_inputs:
                        continue
                    kw = field_keyword(page, el)
                    for pat, pkey in TEXT_MAP:
                        if re.search(pat, kw):
                            cur = el.input_value()
                            if not cur:
                                el.fill(P[pkey])
                                filled += 1
                                print(f"  [fill] {pkey:12s} <- field({kw[:40]!r})")
                            seen_inputs.add(key)
                            break
                except Exception:
                    continue
            if filled:
                break
            time.sleep(3)

        # attach PDFs to file inputs by label keyword
        file_inputs = page.query_selector_all("input[type='file']")
        doc_for = {"cv": None, "cover": None, "research": None}
        for pdf in pdfs:
            n = pdf.name.lower()
            if "cv" in n: doc_for["cv"] = str(pdf)
            elif "cover" in n: doc_for["cover"] = str(pdf)
            elif "research" in n or "statement" in n: doc_for["research"] = str(pdf)
        for el in file_inputs:
            try:
                kw = field_keyword(page, el)
                pick = None
                if re.search(r"cv|curriculum|resume", kw): pick = doc_for["cv"]
                elif re.search(r"cover|motivat|letter", kw): pick = doc_for["cover"]
                elif re.search(r"research|statement|proposal", kw): pick = doc_for["research"]
                if pick:
                    el.set_input_files(pick)
                    print(f"  [upload] {pathlib.Path(pick).name} -> field({kw[:40]!r})")
            except Exception:
                continue

        shot = recon / "headed_fill_stopped_at_submit.png"
        page.screenshot(path=str(shot), full_page=True)
        print(f"[shot] {shot}")
        print(f"[done] auto-filled {filled} text field(s). STOPPED before submit. "
              "Window stays open — review and click submit yourself.")
        # keep the visible window open for the human to finish + submit
        time.sleep(1800)
        ctx.close()

if __name__ == "__main__":
    main()
