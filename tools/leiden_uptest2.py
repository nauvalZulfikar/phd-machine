#!/usr/bin/env python3
"""Find what actually triggers the SF upload on slot 66: try (A) trusted Playwright click,
(B) JS dispatchEvent, (C) direct juic.fire, (D) click attachActions parent. After each,
poll for an injected file-input / native chooser, and if an input appears, set the CV file."""
import os, time, pathlib
from playwright.sync_api import sync_playwright
PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; RECON=PHD/"in-process"/OPP/"portal_recon"
REG_PW=os.environ.get("PHD_REG_PW",""); CV=str(PHD/"in-process"/OPP/"documents"/"nauval_zulfikar_leiden_cv.pdf")
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
def state(page):
    return page.evaluate("""()=>{
        const f=document.getElementById('66:_attachForm');
        return {form:f?f.innerHTML.length:-1, files:document.querySelectorAll('input[type=file]').length,
                juic:(typeof juic)}}""")
def try_set(page):
    fi=page.query_selector('input[type="file"]')
    if fi:
        try: fi.set_input_files(CV); log("   -> set_input_files OK"); return True
        except Exception as e: log(f"   -> set warn {str(e)[:40]}")
    return False
def main():
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach]{reach(page)}")
        fc=[False]
        page.on("filechooser", lambda c:(c.set_files(CV), fc.__setitem__(0,True), log("[filechooser] FIRED")))
        log(f"[state0] {state(page)}")

        # A) trusted Playwright click on icon
        try: page.click('[id="66:_attachIcon"]', timeout=3000); log("[A] pw click icon")
        except Exception as e: log(f"[A] {str(e)[:40]}")
        time.sleep(2); log(f"  A state {state(page)} fc={fc[0]}")
        if try_set(page) or fc[0]: log("[WIN] A"); _finish(page); return

        # B) JS dispatchEvent on icon
        page.evaluate("""()=>{const el=document.getElementById('66:_attachIcon');
            el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}""")
        time.sleep(2); log(f"  B state {state(page)} fc={fc[0]}")
        if try_set(page) or fc[0]: log("[WIN] B"); _finish(page); return

        # C) direct juic.fire
        r=page.evaluate("""()=>{try{juic.fire('66:','action',new MouseEvent('click'));return 'fired'}catch(e){return 'err:'+e.message}}""")
        log(f"[C] juic.fire -> {r}")
        time.sleep(2); log(f"  C state {state(page)} fc={fc[0]}")
        if try_set(page) or fc[0]: log("[WIN] C"); _finish(page); return

        # D) click attachActions parent div (trusted)
        try:
            page.eval_on_selector('[id="66:_attach"] .attachActions', "el=>el.scrollIntoView()")
            page.click('[id="66:_attach"] .attachActions', timeout=3000); log("[D] pw click attachActions")
        except Exception as e: log(f"[D] {str(e)[:40]}")
        time.sleep(2); log(f"  D state {state(page)} fc={fc[0]}")
        if try_set(page) or fc[0]: log("[WIN] D"); _finish(page); return

        log("[FAIL] none of A-D triggered an upload input")
        _finish(page)
def _finish(page):
    page.screenshot(path=str(RECON/"uptest2.png"), full_page=True)
    ok=page.evaluate("()=>{const e=document.getElementById('66:_attachSuccess');return e?!e.className.includes('displayNone'):false}")
    log(f"[result] success_marker={ok}")
    log("[done]"); time.sleep(2400)
if __name__=="__main__": main()
