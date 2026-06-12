#!/usr/bin/env python3
"""Deterministic headed application-form filler with auto sign-in.

Human handles ONLY: CAPTCHA / fee / final Submit. This script:
  - signs in automatically (email + password from env PHD_REG_PW),
  - re-clicks Apply to reach the application form,
  - fills standard text fields from profile, uploads the right PDFs (incl. hidden inputs),
  - STOPS at submit and screenshots. Window stays open for the human to submit.

Run: PHD_REG_PW='...' .venv/python -u headed_filler.py <opp> <job_url>
"""
import sys, os, time, pathlib, re
from playwright.sync_api import sync_playwright

PHD = pathlib.Path.home() / "coding-projects" / "phd"
P = {
    "full_name": "Nauval Zulfikar", "first_name": "Nauval", "last_name": "Zulfikar",
    "email": "zulfikar.nauval1998@gmail.com", "phone": "+44 7300 469048",
    "city": "Bandung", "country": "Indonesia", "nationality": "Indonesian",
    "linkedin": "https://www.linkedin.com/in/nauval-zulfikar",
    "github": "https://github.com/nauvalZulfikar",
    "portfolio": "https://nauvalzulfikar.vercel.app",
}
TEXT_MAP = [
    (r"first.?name|given.?name|voornaam", "first_name"),
    (r"last.?name|surname|family.?name|achternaam", "last_name"),
    (r"full.?name|your name|^naam$|^name$", "full_name"),
    (r"e.?mail", "email"),
    (r"phone|mobile|tel|telefoon|telefono", "phone"),
    (r"nationalit", "nationality"),
    (r"city|town|woonplaats|citt", "city"),
    (r"country|land|paese", "country"),
    (r"linkedin", "linkedin"), (r"github", "github"),
    (r"portfolio|website|personal.?page", "portfolio"),
]

def opp_root(o):
    return PHD/("in-process" if (PHD/"in-process"/o).exists() else "missed")/o
def opp_docs(o):
    d = opp_root(o)/"documents"
    return d, (sorted(d.glob("*.pdf")) if d.exists() else [])
def field_keyword(page, el):
    parts = [el.get_attribute(a) or "" for a in ("aria-label","placeholder","name","id")]
    fid = el.get_attribute("id")
    if fid:
        lab = page.query_selector(f"label[for='{fid}']")
        if lab: parts.append(lab.inner_text())
    return " ".join(parts).lower()
def vis(els):
    out=[]
    for e in els:
        try:
            if e.is_visible(): out.append(e)
        except Exception: pass
    return out

def main():
    opp = sys.argv[1] if len(sys.argv)>1 else "leiden-formal-nlp"
    url = sys.argv[2] if len(sys.argv)>2 else \
        "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
    recon = opp_root(opp)/"portal_recon"; recon.mkdir(parents=True, exist_ok=True)
    pdir = PHD/".browser-profiles"/opp; pdir.mkdir(parents=True, exist_ok=True)
    REG_PW = os.environ.get("PHD_REG_PW","")
    docs_dir, pdfs = opp_docs(opp)
    doc_for = {"cv":None,"cover":None,"research":None,"pub":None}
    for pdf in pdfs:
        n=pdf.name.lower()
        if "cv" in n: doc_for["cv"]=str(pdf)
        elif "cover" in n or "motivation" in n: doc_for["cover"]=str(pdf)
        elif "research" in n or "statement" in n or "proposal" in n or "project" in n: doc_for["research"]=str(pdf)
        elif "publication" in n: doc_for["pub"]=str(pdf)
    print(f"[opp] {opp}\n[docs] {len(pdfs)} -> {doc_for}", flush=True)

    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(pdir), headless=False,
            viewport={"width":1400,"height":950},
            args=["--disable-blink-features=AutomationControlled"])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.screenshot(path=str(recon/"01_loaded.png"), full_page=True)
        print("[wait] auto sign-in + reach the application form. You handle CAPTCHA/fee/Submit.", flush=True)
        for sel in ["button:has-text('Accept All Cookies')","button:has-text('Accept all')","button:has-text('Accept')"]:
            b=page.query_selector(sel)
            if b and b.is_visible():
                try: b.click(); time.sleep(1)
                except Exception: pass
                break

        TXT="input[type='text'], input[type='email'], input[type='tel'], input:not([type]), textarea"
        filled=0; done=False; last_apply=0.0; last_signin=0.0; signin_tries=0
        deadline=time.time()+1500
        while time.time()<deadline and not done:
            try:
                now=time.time()
                try: page.screenshot(path=str(recon/"live.png"))
                except Exception: pass
                files=page.query_selector_all("input[type='file']")   # incl. hidden
                fields=vis(page.query_selector_all(TXT))
                pwf=vis(page.query_selector_all("input[type='password']"))

                if files:                                # ---- application form ----
                    print(f"[form] application form ({len(fields)} fields, {len(files)} upload slots). Filling.", flush=True)
                    for el in fields:
                        try:
                            if el.input_value(): continue
                            kw=field_keyword(page,el)
                            for pat,pk in TEXT_MAP:
                                if re.search(pat,kw):
                                    el.fill(P[pk]); filled+=1
                                    print(f"  [fill] {pk:11s} <- {kw[:36]!r}", flush=True); break
                        except Exception: continue
                    for el in files:
                        try:
                            kw=field_keyword(page,el); pick=None
                            if re.search(r"cv|curriculum|resume",kw): pick=doc_for["cv"]
                            elif re.search(r"cover|motivat|letter",kw): pick=doc_for["cover"]
                            elif re.search(r"research|statement|proposal|project",kw): pick=doc_for["research"]
                            elif re.search(r"publicat",kw): pick=doc_for["pub"]
                            if pick:
                                el.set_input_files(pick)
                                print(f"  [upload] {pathlib.Path(pick).name} <- {kw[:30]!r}", flush=True)
                        except Exception: continue
                    done=True; break

                if len(pwf)==1:                          # ---- Sign In page: auto login ----
                    if REG_PW and now-last_signin>12 and signin_tries<4:
                        for el in fields:
                            try:
                                if not el.input_value() and re.search(r"e.?mail", field_keyword(page,el)):
                                    el.fill(P["email"])
                            except Exception: pass
                        try: pwf[0].fill(REG_PW)
                        except Exception: pass
                        for sel in ["button:has-text('Sign In')","button:has-text('Sign in')",
                                    "button:has-text('Log in')","button:has-text('Login')","input[type='submit']"]:
                            b=page.query_selector(sel)
                            if b and b.is_visible():
                                print(f"[signin] attempt {signin_tries+1}", flush=True); b.click(); break
                        last_signin=now; signin_tries+=1; time.sleep(5); continue
                    time.sleep(3); continue

                if len(pwf)>=2:                           # registration page (shouldn't happen post-account)
                    print("[note] registration page detected — handled by register_filler, skipping.", flush=True)
                    time.sleep(4); continue

                if len(fields)>=3:                        # logged-in form STEP (e.g. personal details, no uploads yet)
                    sf=0
                    for el in fields:
                        try:
                            if el.input_value(): continue
                            kw=field_keyword(page,el)
                            for pat,pk in TEXT_MAP:
                                if re.search(pat,kw):
                                    el.fill(P[pk]); sf+=1; filled+=1
                                    print(f"  [fill] {pk:11s} <- {kw[:34]!r}", flush=True); break
                        except Exception: continue
                    if sf: print(f"[step] filled {sf} field(s) — click Next/Continue for the next step.", flush=True)
                    time.sleep(4); continue

                if now-last_apply>6:                      # posting page -> (re)click Apply
                    for sel in ["a:has-text('Apply')","button:has-text('Apply')","a:has-text('Solliciteer')"]:
                        b=page.query_selector(sel)
                        if b and b.is_visible():
                            print("[click] Apply", flush=True); b.click(); last_apply=now; time.sleep(4); break
                time.sleep(3)
            except Exception as e:
                print(f"  [warn] {str(e)[:70]}", flush=True); time.sleep(3)

        shot=recon/"headed_fill_stopped_at_submit.png"; page.screenshot(path=str(shot), full_page=True)
        if done:
            print(f"[done] filled {filled} field(s) + uploaded docs. STOPPED before submit -> {shot}. "
                  "Review on-screen & click Submit.", flush=True)
        else:
            print(f"[timeout] never reached upload form. Screenshot -> {shot}.", flush=True)
        time.sleep(1800); ctx.close()

if __name__=="__main__":
    main()
