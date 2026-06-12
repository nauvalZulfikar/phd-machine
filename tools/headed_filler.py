#!/usr/bin/env python3
"""Deterministic headed form-filler for PhD application portals.

Human does login/CAPTCHA/fee/email-verify (the part bots can't). This script waits
patiently, SKIPS login/registration pages, and only auto-fills + screenshots the REAL
application form — anchored to the presence of file-upload (CV) boxes. It fills standard
text fields from shared/profile.yaml, attaches the right PDFs, and STOPS at submit.
Window stays open so the human reviews + clicks submit.

Run:  .venv/python -u headed_filler.py <opp_folder> <portal_url>
Persistent profile per opp so a login sticks across runs.
"""
import sys, time, pathlib, re
from playwright.sync_api import sync_playwright

PHD = pathlib.Path.home() / "coding-projects" / "phd"
SHARED = PHD / "shared"

P = {
    "full_name": "Nauval Zulfikar", "first_name": "Nauval", "last_name": "Zulfikar",
    "email": "zulfikar.nauval1998@gmail.com", "phone": "+44 7300 469048",
    "city": "Bandung", "country": "Indonesia", "nationality": "Indonesian",
    "linkedin": "https://www.linkedin.com/in/nauval-zulfikar",
    "github": "https://github.com/nauvalZulfikar",
    "portfolio": "https://nauvalzulfikar.vercel.app",
}
TEXT_MAP = [
    (r"first.?name|given.?name|voornaam|nome", "first_name"),
    (r"last.?name|surname|family.?name|achternaam|cognome", "last_name"),
    (r"full.?name|your name|^naam$|^name$", "full_name"),
    (r"e.?mail", "email"),
    (r"phone|mobile|tel|telefoon|telefono", "phone"),
    (r"nationalit", "nationality"),
    (r"city|town|woonplaats|citt", "city"),
    (r"country|land|paese", "country"),
    (r"linkedin", "linkedin"), (r"github", "github"),
    (r"portfolio|website|personal.?page", "portfolio"),
]

def opp_root(opp):
    return PHD / ("in-process" if (PHD/"in-process"/opp).exists() else "missed") / opp

def opp_docs(opp):
    d = opp_root(opp) / "documents"
    return d, (sorted(d.glob("*.pdf")) if d.exists() else [])

def field_keyword(page, el):
    parts = []
    for attr in ("aria-label", "placeholder", "name", "id"):
        parts.append(el.get_attribute(attr) or "")
    fid = el.get_attribute("id")
    if fid:
        lab = page.query_selector(f"label[for='{fid}']")
        if lab:
            parts.append(lab.inner_text())
    return " ".join(parts).lower()

def visible(els):
    out = []
    for e in els:
        try:
            if e.is_visible():
                out.append(e)
        except Exception:
            pass
    return out

def main():
    opp = sys.argv[1] if len(sys.argv) > 1 else "leiden-formal-nlp"
    url = sys.argv[2] if len(sys.argv) > 2 else \
        "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
    recon = opp_root(opp) / "portal_recon"; recon.mkdir(parents=True, exist_ok=True)
    profile_dir = PHD / ".browser-profiles" / opp; profile_dir.mkdir(parents=True, exist_ok=True)
    docs_dir, pdfs = opp_docs(opp)
    doc_for = {"cv": None, "cover": None, "research": None, "pub": None}
    for pdf in pdfs:
        n = pdf.name.lower()
        if "cv" in n: doc_for["cv"] = str(pdf)
        elif "cover" in n or "motivation" in n: doc_for["cover"] = str(pdf)
        elif "research" in n or "statement" in n or "proposal" in n or "project" in n: doc_for["research"] = str(pdf)
        elif "publication" in n: doc_for["pub"] = str(pdf)
    print(f"[opp] {opp}\n[url] {url}\n[docs] {len(pdfs)} pdf(s) -> {doc_for}", flush=True)

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir), headless=False,
            viewport={"width": 1400, "height": 950},
            args=["--disable-blink-features=AutomationControlled"])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.screenshot(path=str(recon / "01_loaded.png"), full_page=True)
        print("[wait] loaded. I SKIP login/registration; I fill ONLY the real application "
              "form (the one with CV-upload boxes). Do your login/verify in this window.", flush=True)

        # best-effort cookie accept
        for sel in ["button:has-text('Accept All Cookies')", "button:has-text('Accept all')",
                    "button:has-text('Accept')", "text=Accept All Cookies"]:
            try:
                b = page.query_selector(sel)
                if b and b.is_visible():
                    b.click(); time.sleep(1); break
            except Exception:
                pass

        filled = 0; done = False; clicked_apply = False
        deadline = time.time() + 1500  # 25 min
        TXT = "input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea"
        while time.time() < deadline and not done:
            try:
                files = visible(page.query_selector_all("input[type='file']"))
                fields = visible(page.query_selector_all(TXT))
                has_pw = len(visible(page.query_selector_all("input[type='password']"))) > 0

                if files:  # ---- REAL application form (anchored on upload boxes) ----
                    print(f"[form] application form detected ({len(fields)} fields, "
                          f"{len(files)} upload slots). Filling.", flush=True)
                    for el in fields:
                        try:
                            if el.input_value(): continue
                            kw = field_keyword(page, el)
                            for pat, pkey in TEXT_MAP:
                                if re.search(pat, kw):
                                    el.fill(P[pkey]); filled += 1
                                    print(f"  [fill] {pkey:11s} <- {kw[:38]!r}", flush=True); break
                        except Exception: continue
                    for el in files:
                        try:
                            kw = field_keyword(page, el); pick = None
                            if re.search(r"cv|curriculum|resume", kw): pick = doc_for["cv"]
                            elif re.search(r"cover|motivat|letter", kw): pick = doc_for["cover"]
                            elif re.search(r"research|statement|proposal|project", kw): pick = doc_for["research"]
                            elif re.search(r"publicat", kw): pick = doc_for["pub"]
                            if pick:
                                el.set_input_files(pick)
                                print(f"  [upload] {pathlib.Path(pick).name} <- {kw[:34]!r}", flush=True)
                        except Exception: continue
                    done = True; break

                if has_pw:  # login / registration — pre-fill name+email, DON'T stop
                    for el in fields:
                        try:
                            if el.input_value(): continue
                            kw = field_keyword(page, el)
                            for pat, pkey in TEXT_MAP:
                                if pkey in ("email","first_name","last_name","full_name") and re.search(pat, kw):
                                    el.fill(P[pkey]); print(f"  [auth-fill] {pkey} <- {kw[:30]!r}", flush=True); break
                        except Exception: continue
                    time.sleep(3); continue

                if len(fields) < 3 and not clicked_apply:  # posting page -> click Apply once
                    for sel in ["a:has-text('Apply')","button:has-text('Apply')",
                                "a:has-text('Solliciteer')","button:has-text('Solliciteer')"]:
                        b = page.query_selector(sel)
                        if b and b.is_visible():
                            print(f"  [click] Apply", flush=True); b.click(); clicked_apply = True
                            time.sleep(4); break
                time.sleep(3)
            except Exception as e:
                print(f"  [warn] {str(e)[:80]}", flush=True); time.sleep(3)

        shot = recon / "headed_fill_stopped_at_submit.png"
        page.screenshot(path=str(shot), full_page=True)
        if done:
            print(f"[done] filled {filled} field(s) + uploaded docs on the application form. "
                  f"STOPPED before submit -> {shot}. Review on-screen & click Submit yourself.", flush=True)
        else:
            print(f"[timeout] no upload-form reached in 25 min. Screenshot -> {shot}. "
                  "Window stays open; continue manually.", flush=True)
        time.sleep(1800)
        ctx.close()

if __name__ == "__main__":
    main()
