#!/usr/bin/env python3
"""Nail the SuccessFactors upload mechanism on the CV slot (66): click '+', then poll
for the injected file-input and set the file directly. Report what appears."""
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
def main():
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach]{reach(page)}")
        chooser_fired=[False]
        def on_fc(fc):
            try: fc.set_files(CV); chooser_fired[0]=True; log("[filechooser] fired -> set CV")
            except Exception as e: log(f"[fc warn]{e}")
        page.on("filechooser", on_fc)
        # click the + icon for 66
        icon=page.query_selector('[id="66:_attachIcon"]')
        log(f"[icon] found={icon is not None}")
        if icon:
            try: icon.click(timeout=4000); log("[click] icon 66")
            except Exception as e: log(f"[click warn]{str(e)[:50]}")
        # poll for injected input + state changes
        for s in range(12):
            time.sleep(1)
            form_html=page.evaluate("()=>{const e=document.getElementById('66:_attachForm');return e?e.innerHTML.length:-1}")
            n_file=len(page.query_selector_all('input[type="file"]'))
            modal=page.evaluate("""()=>{const ds=[...document.querySelectorAll('[role=dialog],.modal,.ui-dialog,[class*=popup]')].filter(e=>e.offsetParent);return ds.map(e=>e.className).slice(0,3)}""")
            log(f"  t+{s+1}s attachForm_html_len={form_html} file_inputs={n_file} modals={modal} fc={chooser_fired[0]}")
            if n_file>0:
                fi=page.query_selector('[id="66:_attachForm"] input[type="file"]') or page.query_selector('input[type="file"]')
                try:
                    fi.set_input_files(CV); log("[set_input_files] done on injected input"); time.sleep(3); break
                except Exception as e: log(f"[set warn]{str(e)[:50]}")
            if chooser_fired[0]: break
        page.screenshot(path=str(RECON/"uptest.png"), full_page=True)
        # did it work? check success marker
        ok=page.evaluate("()=>{const e=document.getElementById('66:_attachSuccess');return e?!e.className.includes('displayNone'):false}")
        log(f"[result] upload_success_marker={ok}")
        log("[done]")
        time.sleep(2400); ctx.close()
if __name__=="__main__": main()
