#!/usr/bin/env python3
"""Finish the Leiden application end-to-end:
 - auto sign-in -> reach form -> expand sections
 - UPLOAD via the cracked SF mechanism (JS-dispatch click injects input -> set_input_files -> wait)
 - fill every empty field (phone, city, references) + best-effort picklists (gender/language/how-heard)
 - screenshot. STOPS before final Apply/Submit.
"""
import os, time, pathlib, re, json
from playwright.sync_api import sync_playwright

PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; RECON=PHD/"in-process"/OPP/"portal_recon"
DOCS=PHD/"in-process"/OPP/"documents"; REFS=PHD/"shared"/"references"
REG_PW=os.environ.get("PHD_REG_PW","")
CV=str(DOCS/"nauval_zulfikar_leiden_cv.pdf"); COVER=str(DOCS/"nauval_zulfikar_leiden_cover_letter.pdf")
RES=str(DOCS/"nauval_zulfikar_leiden_research_statement.pdf"); PUB=str(DOCS/"nauval_zulfikar_leiden_publication_list.pdf")
AMMAR=str(REFS/"ammar_al-bazi_reference.pdf"); VIKTOR=str(REFS/"viktor_pekar_reference.pdf")
def log(m): print(m, flush=True)

def reach(page):
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    b=page.query_selector("button:has-text('Accept')")
    if b and b.is_visible():
        try: b.click(); time.sleep(1)
        except Exception: pass
    dl=time.time()+90; tries=0
    while time.time()<dl:
        try:
            if page.query_selector("text=My Documents"): return True
            pwf=[e for e in page.query_selector_all("input[type='password']") if e.is_visible()]
            if len(pwf)==1 and REG_PW and tries<3:
                for el in page.query_selector_all("input[type='email'],input[type='text']"):
                    try:
                        if not el.input_value() and "mail" in (el.get_attribute("name") or el.get_attribute("id") or "").lower():
                            el.fill("zulfikar.nauval1998@gmail.com")
                    except Exception: pass
                try: pwf[0].fill(REG_PW)
                except Exception: pass
                bb=page.query_selector("button:has-text('Sign In')") or page.query_selector("input[type='submit']")
                if bb: bb.click()
                tries+=1
                try: page.wait_for_load_state("networkidle", timeout=12000)
                except Exception: pass
                time.sleep(2); continue
            ap=page.query_selector("a:has-text('Apply')") or page.query_selector("button:has-text('Apply')")
            if ap and ap.is_visible(): ap.click(); time.sleep(4); continue
            time.sleep(2)
        except Exception as e: log(f"[reach warn]{str(e)[:40]}"); time.sleep(2)
    return False

def enum_slots(page):
    return page.evaluate("""()=>{
        const out=[];
        document.querySelectorAll('[id$=":_attachIcon"]').forEach(ic=>{
            const fid=ic.id.split(':')[0];
            const lab=document.getElementById(fid+':_ariaAttachLabel');
            const succ=document.getElementById(fid+':_attachSuccess');
            out.push({fid, label:(lab?lab.innerText:'').trim().toLowerCase(),
                      done: succ?!succ.className.includes('displayNone'):false});
        });
        return out;
    }""")

def upload(page, fid, doc):
    if not pathlib.Path(doc).exists():
        log(f"   [skip] missing {doc}"); return False
    page.evaluate("(f)=>{const el=document.getElementById(f+':_attachIcon');"
                  "if(el) el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}", fid)
    inp=None
    for _ in range(10):
        time.sleep(1)
        inp=page.query_selector(f'[id="{fid}:_attachForm"] input[type="file"]') or page.query_selector('input[type="file"]')
        if inp: break
    if not inp:
        log(f"   [warn] no input injected for {fid}"); return False
    try: inp.set_input_files(doc)
    except Exception as e: log(f"   [warn] setfiles {fid}: {str(e)[:40]}"); return False
    for _ in range(25):
        time.sleep(1)
        ok=page.evaluate("(f)=>{const e=document.getElementById(f+':_attachSuccess');return e?!e.className.includes('displayNone'):false}", fid)
        loading=page.evaluate("(f)=>{const e=document.getElementById(f+':_attachLoading');return e?!e.className.includes('displayNone'):false}", fid)
        if ok: log(f"   [UP] {pathlib.Path(doc).name} -> slot {fid} ✓"); return True
        if not loading and _>3: break
    log(f"   [UP?] {pathlib.Path(doc).name} -> slot {fid} (no success marker, check)"); return True

def do_uploads(page):
    slots=enum_slots(page); log(f"[slots] {json.dumps(slots)}")
    generic=[]
    for s in slots:
        L=s["label"]
        if s["done"] or "download document" in L:  # already uploaded
            log(f"   [have] slot {s['fid']} already filled"); continue
        if re.search(r"curriculum|resume", L): upload(page,s["fid"],CV)
        elif re.search(r"motivat|cover", L): upload(page,s["fid"],COVER)
        else: generic.append(s["fid"])          # 'add a document' slots
    # generic slots -> research, publication, then the 2 signed reference letters
    for fid,doc in zip(generic, [RES,PUB,AMMAR,VIKTOR]):
        upload(page,fid,doc); time.sleep(1)

def expand_all(page):
    # dispatch-click every collapsed section header (same trick that beat the uploads)
    n=page.evaluate("""()=>{let c=0;
        document.querySelectorAll('[class*=topBar],[class*=rcmFormSectionTopBar],button[aria-expanded]').forEach(b=>{
            if(b.getAttribute('aria-expanded')==='false'){
                b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); c++;}
        });return c;}""")
    log(f"[expand] dispatched on {n} collapsed section(s)"); time.sleep(2)

def fill_txt(page, name, val):
    el=page.query_selector(f'input[name="{name}"]')
    if not el: log(f"  [warn] {name} not found"); return
    try:
        if el.input_value(): return
        el.scroll_into_view_if_needed(timeout=2000)
        el.fill(val, timeout=5000); log(f"  [fill] {name}={val}")
    except Exception as e: log(f"  [warn] {name}: {str(e)[:34]}")

def picklist(page, label_kw, val):
    base=page.evaluate("""(kw)=>{for(const l of document.querySelectorAll('label')){
        if((l.innerText||'').toLowerCase().includes(kw)){const f=l.getAttribute('for');
        if(f) return f.split(':')[0];}} return null;}""", label_kw)
    if not base: log(f"  [warn] picklist '{label_kw}' label not found"); return
    el=page.query_selector(f'[id="{base}:_input"]')
    if not el: log(f"  [warn] picklist '{label_kw}' input {base} not found"); return
    try:
        el.scroll_into_view_if_needed(timeout=2000); el.click(timeout=4000); time.sleep(0.5)
        el.fill(val, timeout=4000); time.sleep(1.4)
        # SF typeahead suggestion list -> click exact/first match, else keyboard
        clicked=page.evaluate("""(args)=>{const [b,v]=args;
            const lists=[...document.querySelectorAll('[id^="'+b+'"] li,[id^="'+b+'"] [role=option],. acaSuggestList li,ul li')]
              .filter(e=>e.offsetParent && (e.innerText||'').trim());
            for(const e of lists){if((e.innerText||'').trim().toLowerCase()===v.toLowerCase()){
              e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));e.dispatchEvent(new MouseEvent('click',{bubbles:true,view:window}));return e.innerText.trim();}}
            for(const e of lists){if((e.innerText||'').trim().toLowerCase().includes(v.toLowerCase())){
              e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));e.dispatchEvent(new MouseEvent('click',{bubbles:true,view:window}));return e.innerText.trim();}}
            return '';}""", [base,val])
        if clicked: log(f"  [picklist] {label_kw} -> {clicked}")
        else:
            page.keyboard.press("ArrowDown"); time.sleep(0.4); page.keyboard.press("Enter")
            log(f"  [picklist] {label_kw} -> {val} (kbd fallback)")
        time.sleep(0.6)
    except Exception as e: log(f"  [warn] picklist {label_kw}: {str(e)[:40]}")

def main():
    RECON.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach]{reach(page)}")
        b=page.query_selector("text=Expand all sections") or page.query_selector("a:has-text('Expand all')")
        if b:
            try: b.click(); time.sleep(2)
            except Exception: pass
        expand_all(page)
        log("=== UPLOADS ==="); do_uploads(page)
        log("=== TEXT FIELDS ===")
        fill_txt(page,"cellPhone","+44 7300 469048")
        fill_txt(page,"cust_city","Bandung")
        fill_txt(page,"referent1_naam","Ammar Al-Bazi")
        fill_txt(page,"referent1_functie","Associate Professor (MSc Supervisor), Aston University")
        fill_txt(page,"referent1_email","a.al-bazi@aston.ac.uk")
        fill_txt(page,"referent2_naam","Viktor Pekar")
        fill_txt(page,"referent2_functie","Senior Lecturer, Aston University")
        fill_txt(page,"referent2_email","v.pekar@aston.ac.uk")
        log("=== PICKLISTS ===")
        picklist(page,"gender","Male")
        picklist(page,"communication language","English")
        picklist(page,"how did you hear","Website")
        time.sleep(2)
        page.screenshot(path=str(RECON/"finish_prefill.png"), full_page=True)
        # PERSIST: click Save (not Apply/Submit) so nothing is lost on reload
        saved=False
        for sel in ["button:has-text('Save')","a:has-text('Save')","input[value='Save']"]:
            b=page.query_selector(sel)
            if b and b.is_visible():
                try: b.click(); saved=True; log("[SAVE] clicked Save"); break
                except Exception as e: log(f"[warn] save: {str(e)[:40]}")
        time.sleep(8)  # let SF persist server-side
        page.screenshot(path=str(RECON/"finish.png"), full_page=True)
        log(f"[done] uploads+fields+picklists done, saved={saved}. STOPPED before final Apply/Submit.")
        time.sleep(3000); ctx.close()

if __name__=="__main__": main()
