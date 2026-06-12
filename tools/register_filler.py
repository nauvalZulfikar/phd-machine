#!/usr/bin/env python3
"""Headed registration-form filler (self-correcting).
Navigates job -> Apply -> (Sign In -> Create an account) -> registration form,
fills name/email/password/country/terms, and clicks Create Account.
Distinguishes Sign-In (1 pw) from Registration (>=2 pw) so it never fills login by mistake.
Password comes from env PHD_REG_PW (never written to disk).

Run: PHD_REG_PW='...' .venv/python -u register_filler.py <opp> <job_url>
"""
import sys, os, time, pathlib, re
from playwright.sync_api import sync_playwright

PHD = pathlib.Path.home() / "coding-projects" / "phd"
P = {"first_name":"Nauval","last_name":"Zulfikar","full_name":"Nauval Zulfikar",
     "email":"zulfikar.nauval1998@gmail.com","phone":"+44 7300 469048",
     "city":"Bandung","country":"Indonesia"}
TEXT_MAP = [
    (r"first.?name|given.?name|voornaam|preferred", "first_name"),
    (r"last.?name|surname|family.?name|achternaam", "last_name"),
    (r"full.?name|^name$|^naam$", "full_name"),
    (r"e.?mail", "email"),
    (r"phone|mobile|tel|telefoon", "phone"),
    (r"city|town|woonplaats", "city"),
]

def opp_root(o):
    return PHD/("in-process" if (PHD/"in-process"/o).exists() else "missed")/o
def kw_of(page, el):
    parts=[el.get_attribute(a) or "" for a in ("aria-label","placeholder","name","id")]
    fid=el.get_attribute("id")
    if fid:
        lab=page.query_selector(f"label[for='{fid}']")
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
    opp=sys.argv[1] if len(sys.argv)>1 else "leiden-formal-nlp"
    url=sys.argv[2] if len(sys.argv)>2 else \
        "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
    recon=opp_root(opp)/"portal_recon"; recon.mkdir(parents=True, exist_ok=True)
    pdir=PHD/".browser-profiles"/opp; pdir.mkdir(parents=True, exist_ok=True)
    REG_PW=os.environ.get("PHD_REG_PW","")

    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(
            user_data_dir=str(pdir), headless=False,
            viewport={"width":1400,"height":950},
            args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        print("[nav] loaded job page", flush=True)
        for sel in ["button:has-text('Accept All Cookies')","button:has-text('Accept all')","button:has-text('Accept')"]:
            b=page.query_selector(sel)
            if b and b.is_visible():
                try: b.click(); time.sleep(1)
                except Exception: pass
                break
        for sel in ["a:has-text('Apply')","button:has-text('Apply')"]:
            b=page.query_selector(sel)
            if b and b.is_visible():
                print("[click] Apply", flush=True); b.click(); time.sleep(4); break

        filled=0; done=False; deadline=time.time()+300; last_action=""
        while time.time()<deadline and not done:
            try:
                pwf=vis(page.query_selector_all("input[type='password']"))
                txt=vis(page.query_selector_all("input[type='text'], input[type='email'], input[type='tel'], input:not([type])"))
                if len(pwf)>=2:                       # ---- REGISTRATION form ----
                    print(f"[form] registration ({len(txt)} text + {len(pwf)} pw)", flush=True)
                    for el in txt:
                        try:
                            if el.input_value(): continue
                            kw=kw_of(page,el)
                            for pat,pk in TEXT_MAP:
                                if re.search(pat,kw):
                                    el.fill(P[pk]); filled+=1
                                    print(f"  [fill] {pk:11s} <- {kw[:34]!r}", flush=True); break
                        except Exception: continue
                    if REG_PW:
                        for el in pwf:
                            try: el.fill(REG_PW)
                            except Exception: pass
                        print("  [fill] password (both)", flush=True)
                    for s in vis(page.query_selector_all("select")):
                        try:
                            if re.search(r"country|land", kw_of(page,s)):
                                s.select_option(label="Indonesia"); print("  [select] country<-Indonesia", flush=True); break
                        except Exception: continue
                    for cb in vis(page.query_selector_all("input[type='checkbox']")):
                        try:
                            k=kw_of(page,cb)
                            if re.search(r"term|privacy|accept|agree|statement", k) and not re.search(r"notif|newsletter|updates", k):
                                if not cb.is_checked(): cb.check(); print("  [check] terms", flush=True)
                        except Exception: continue
                    done=True; break
                elif len(pwf)==1:                     # ---- SIGN-IN page: go to register ----
                    if last_action!="create":
                        for sel in ["a:has-text('Create an account')","a:has-text('Create account')",
                                    "a:has-text('register')","text=Create an account"]:
                            b=page.query_selector(sel)
                            if b and b.is_visible():
                                print("[click] Create an account", flush=True); b.click(); last_action="create"; time.sleep(4); break
                        else:
                            time.sleep(2)
                    else:
                        time.sleep(2)
                else:                                  # posting / loading
                    time.sleep(2)
            except Exception as e:
                print(f"  [warn] {str(e)[:70]}", flush=True); time.sleep(3)

        page.screenshot(path=str(recon/"register_filled.png"), full_page=True)
        clicked=False
        if done:
            for sel in ["button:has-text('Create Account')","button:has-text('Create account')",
                        "input[type='submit']","button:has-text('Register')"]:
                b=page.query_selector(sel)
                if b and b.is_visible():
                    try: b.click(); clicked=True; print("[click] Create Account", flush=True)
                    except Exception as e: print(f"[warn] submit: {str(e)[:60]}", flush=True)
                    break
        time.sleep(6)
        page.screenshot(path=str(recon/"register_after.png"), full_page=True)
        print(f"[done] reg_form_filled={done} fields={filled} submit_clicked={clicked} "
              f"-> {recon/'register_after.png'}. If OK: check email for verification link.", flush=True)
        time.sleep(1800); ctx.close()

if __name__=="__main__":
    main()
