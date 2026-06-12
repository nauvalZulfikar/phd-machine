#!/usr/bin/env python3
"""Complete the Leiden application: auto sign-in -> reach form -> expand sections ->
upload the 4 PDFs (handles hidden inputs, iframe inputs, AND click-to-open file choosers)
-> fill all text fields -> screenshot. STOPS before submit.

Run: PHD_REG_PW='...' .venv/python -u leiden_complete.py
"""
import os, time, pathlib, re
from playwright.sync_api import sync_playwright

PHD = pathlib.Path.home()/"coding-projects"/"phd"
OPP = "leiden-formal-nlp"
URL = "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
DOCS = PHD/"in-process"/OPP/"documents"
RECON = PHD/"in-process"/OPP/"portal_recon"
PDIR = PHD/".browser-profiles"/OPP
REG_PW = os.environ.get("PHD_REG_PW","")
CV   = str(DOCS/"nauval_zulfikar_leiden_cv.pdf")
COVER= str(DOCS/"nauval_zulfikar_leiden_cover_letter.pdf")
RES  = str(DOCS/"nauval_zulfikar_leiden_research_statement.pdf")
PUB  = str(DOCS/"nauval_zulfikar_leiden_publication_list.pdf")

P = {"first_name":"Nauval","last_name":"Zulfikar","full_name":"Nauval Zulfikar",
     "email":"zulfikar.nauval1998@gmail.com","phone":"+44 7300 469048",
     "city":"Bandung","country":"Indonesia","nationality":"Indonesian",
     "linkedin":"https://www.linkedin.com/in/nauval-zulfikar",
     "github":"https://github.com/nauvalZulfikar","portfolio":"https://nauvalzulfikar.vercel.app"}
TEXT_MAP = [
    (r"first.?name|given.?name|voornaam","first_name"),
    (r"last.?name|surname|family.?name|achternaam","last_name"),
    (r"e.?mail","email"), (r"phone|mobile|tel|telefoon","phone"),
    (r"nationalit","nationality"), (r"city|town|woonplaats","city"),
    (r"linkedin","linkedin"), (r"github","github"),
    (r"portfolio|website|personal.?page","portfolio"),
]

def kw_of(frame, el):
    parts=[el.get_attribute(a) or "" for a in ("aria-label","placeholder","name","id")]
    fid=el.get_attribute("id")
    if fid:
        try:
            lab=frame.query_selector(f"label[for='{fid}']")
            if lab: parts.append(lab.inner_text())
        except Exception: pass
    return " ".join(parts).lower()

def log(m): print(m, flush=True)

def reach_form(page):
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    for sel in ["button:has-text('Accept All Cookies')","button:has-text('Accept')"]:
        b=page.query_selector(sel)
        if b and b.is_visible():
            try: b.click(); time.sleep(1)
            except Exception: pass
            break
    deadline=time.time()+120; tries=0
    while time.time()<deadline:
        if page.query_selector("text=My Documents") or page.query_selector("input[type='file']"):
            return True
        pwf=[e for e in page.query_selector_all("input[type='password']") if e.is_visible()]
        if len(pwf)==1 and REG_PW and tries<4:
            for el in page.query_selector_all("input[type='text'], input[type='email']"):
                try:
                    if not el.input_value() and re.search(r"e.?mail", kw_of(page,el)): el.fill(P["email"])
                except Exception: pass
            try: pwf[0].fill(REG_PW)
            except Exception: pass
            for sel in ["button:has-text('Sign In')","button:has-text('Sign in')","input[type='submit']"]:
                b=page.query_selector(sel)
                if b and b.is_visible(): log(f"[signin] try {tries+1}"); b.click(); break
            tries+=1; time.sleep(5); continue
        for sel in ["a:has-text('Apply')","button:has-text('Apply')"]:
            b=page.query_selector(sel)
            if b and b.is_visible(): log("[click] Apply"); b.click(); time.sleep(4); break
        time.sleep(2)
    return False

def dump_and_upload(page):
    # expand all sections
    for sel in ["text=Expand all sections","a:has-text('Expand all')","button:has-text('Expand all')"]:
        b=page.query_selector(sel)
        if b and b.is_visible():
            try: b.click(); log("[click] Expand all sections"); time.sleep(2)
            except Exception: pass
            break
    frames=page.frames
    log(f"[dump] {len(frames)} frame(s)")
    # collect file inputs across all frames
    all_file_inputs=[]
    for fr in frames:
        try:
            fis=fr.query_selector_all("input[type='file']")
            for fi in fis: all_file_inputs.append((fr,fi))
        except Exception: pass
    log(f"[dump] file inputs found (all frames, incl hidden): {len(all_file_inputs)}")
    for fr,fi in all_file_inputs:
        log(f"   file-input: name={fi.get_attribute('name')!r} id={fi.get_attribute('id')!r} accept={fi.get_attribute('accept')!r}")

    uploaded=0
    pick_for = lambda kw: (CV if re.search(r"resume|cv|curriculum",kw) else
                           COVER if re.search(r"cover|motivat|letter",kw) else
                           RES if re.search(r"research|statement|proposal|project|other|document",kw) else None)
    # Strategy 1: direct set_input_files on found inputs
    if all_file_inputs:
        for fr,fi in all_file_inputs:
            kw=kw_of(fr,fi)
            pick=pick_for(kw) or CV
            try: fi.set_input_files(pick); uploaded+=1; log(f"   [upload] {pathlib.Path(pick).name} -> input({kw[:30]!r})")
            except Exception as e: log(f"   [warn] direct upload: {str(e)[:50]}")
    # Strategy 2: SuccessFactors '+' attach icons (id like '66:_attachIcon')
    if uploaded==0:
        targets=[("66",CV),("68",COVER),("70",RES),("72",PUB)]
        for fid,doc in targets:
            try:
                btn=page.query_selector(f'[id="{fid}:_attachIcon"]') or page.query_selector(f'[id="{fid}:_attach"] .addAttachments')
                if not btn:
                    log(f"   [skip] no + icon for {fid}"); continue
                with page.expect_file_chooser(timeout=12000) as fc:
                    btn.click(timeout=5000)
                fc.value.set_files(doc); uploaded+=1
                log(f"   [upload+] {pathlib.Path(doc).name} -> attach {fid}"); time.sleep(5)
            except Exception as e:
                log(f"   [warn] +icon {fid}: {str(e)[:60]}")
    return uploaded

def fill_text(page):
    filled=0
    for fr in page.frames:
        try:
            els=fr.query_selector_all("input[type='text'], input[type='email'], input[type='tel'], textarea")
        except Exception: continue
        for el in els:
            try:
                if not el.is_visible() or el.input_value(): continue
                kw=kw_of(fr,el)
                for pat,pk in TEXT_MAP:
                    if re.search(pat,kw):
                        el.fill(P[pk]); filled+=1; log(f"  [fill] {pk:11s} <- {kw[:32]!r}"); break
            except Exception: continue
    # selects -> country=Indonesia
    for fr in page.frames:
        try:
            for s in fr.query_selector_all("select"):
                if s.is_visible() and re.search(r"country|land", kw_of(fr,s)):
                    try: s.select_option(label="Indonesia"); log("  [select] country<-Indonesia")
                    except Exception: pass
        except Exception: continue
    return filled

def main():
    RECON.mkdir(parents=True, exist_ok=True); PDIR.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        ok=reach_form(page)
        log(f"[reach_form] on_form={ok}")
        page.screenshot(path=str(RECON/"complete_01_form.png"), full_page=True)
        up=dump_and_upload(page)
        time.sleep(2)
        fl=fill_text(page)
        time.sleep(2)
        page.screenshot(path=str(RECON/"complete_02_filled.png"), full_page=True)
        log(f"[done] uploaded={up} text_filled={fl}. Screenshots saved. STOPPED before submit.")
        time.sleep(2400); ctx.close()

if __name__=="__main__":
    main()
