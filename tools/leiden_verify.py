#!/usr/bin/env python3
"""Read-only-ish: reach form, expand sections, report uploaded slots + each picklist's
current displayed value, and screenshot the expanded Profile/Job sections."""
import os, time, pathlib, json
from playwright.sync_api import sync_playwright
PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; RECON=PHD/"in-process"/OPP/"portal_recon"; REG_PW=os.environ.get("PHD_REG_PW","")
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
def main():
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":1300}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach]{reach(page)}")
        # expand every collapsed section via real topBar dispatch
        page.evaluate("""()=>{document.querySelectorAll('button[aria-expanded=false],[class*=topBar][aria-expanded=false]').forEach(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})));}""")
        time.sleep(2.5)
        # uploaded slots
        slots=page.evaluate("""()=>{const o=[];document.querySelectorAll('[id$=":_attachLabel"]').forEach(l=>{
            const t=(l.innerText||'').trim(); if(t) o.push(t.slice(0,45));});return o;}""")
        log("[UPLOADED LABELS]\n"+json.dumps(slots, indent=0))
        # picklist current values: for each label kw, find base, read value display text
        for kw in ["gender","communication language","how did you hear","country of residence"]:
            v=page.evaluate("""(kw)=>{
                const labs=[...document.querySelectorAll('label')];
                for(const l of labs){ if((l.innerText||'').toLowerCase().includes(kw)){
                    const f=l.getAttribute('for'); if(!f) continue; const b=f.split(':')[0];
                    const inp=document.getElementById(b+':_input');
                    const vl=document.getElementById(b+':_valueLabel');
                    return {base:b, input_val:inp?inp.value:'(no input)', value_label:vl?vl.innerText.trim():'(no label)'};
                }} return null; }""", kw)
            log(f"[picklist] {kw}: {json.dumps(v)}")
        page.screenshot(path=str(RECON/"verify.png"), full_page=True)
        log("[done]")
        time.sleep(3000); ctx.close()
if __name__=="__main__": main()
