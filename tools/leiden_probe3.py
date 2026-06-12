#!/usr/bin/env python3
"""Dump the exact DOM of (a) the Gender picklist container (to find the clickable trigger +
option source) and (b) the Save button — so we can click them precisely."""
import os, time, pathlib
from playwright.sync_api import sync_playwright
PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; REG_PW=os.environ.get("PHD_REG_PW","")
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
        page.evaluate("""()=>{document.querySelectorAll('button[aria-expanded=false]').forEach(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,view:window})));}""")
        time.sleep(2)
        # gender container
        html=page.evaluate("""()=>{
            for(const l of document.querySelectorAll('label')){
                if((l.innerText||'').toLowerCase().includes('gender')){
                    let n=l; for(let i=0;i<3 && n.parentElement;i++) n=n.parentElement;
                    return n.outerHTML;
                }} return 'NONE';}""")
        log("[GENDER CONTAINER]\n"+html[:2600])
        # save button
        sv=page.evaluate("""()=>{
            const cands=[...document.querySelectorAll('button,a,input[type=button],input[type=submit],[role=button]')]
              .filter(e=>{const t=(e.innerText||e.value||'').trim().toLowerCase(); return t==='save'||t==='apply'||t==='view profile';});
            return cands.map(e=>({tag:e.tagName,txt:(e.innerText||e.value||'').trim(),id:e.id,cls:(e.className||'').slice(0,50),onclick:(e.getAttribute('onclick')||'').slice(0,60)}));
        }""")
        import json; log("[SAVE/APPLY BUTTONS]\n"+json.dumps(sv, indent=1))
        log("[done]")
        time.sleep(3000); ctx.close()
if __name__=="__main__": main()
