#!/usr/bin/env python3
"""Probe Leiden 'My Documents' upload widgets: dump buttons/links + the HTML around
each upload box so we can craft the exact click selector for the file-chooser."""
import os, time, pathlib, re, json
from playwright.sync_api import sync_playwright

PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; RECON=PHD/"in-process"/OPP/"portal_recon"
REG_PW=os.environ.get("PHD_REG_PW","")
def log(m): print(m, flush=True)

def main():
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=60000)
        b=page.query_selector("button:has-text('Accept')")
        if b and b.is_visible():
            try: b.click(); time.sleep(1)
            except Exception: pass
        # reach form (auto signin)
        dl=time.time()+90; tries=0
        while time.time()<dl and not page.query_selector("text=My Documents"):
            pwf=[e for e in page.query_selector_all("input[type='password']") if e.is_visible()]
            if len(pwf)==1 and REG_PW and tries<3:
                for el in page.query_selector_all("input[type='email'], input[type='text']"):
                    try:
                        if not el.input_value() and "mail" in (el.get_attribute("name") or el.get_attribute("id") or "").lower():
                            el.fill("zulfikar.nauval1998@gmail.com")
                    except Exception: pass
                try: pwf[0].fill(REG_PW)
                except Exception: pass
                bb=page.query_selector("button:has-text('Sign In')") or page.query_selector("input[type='submit']")
                if bb: bb.click()
                tries+=1; time.sleep(5); continue
            ap=page.query_selector("a:has-text('Apply')") or page.query_selector("button:has-text('Apply')")
            if ap and ap.is_visible(): ap.click(); time.sleep(4); continue
            time.sleep(2)
        ex=page.query_selector("text=Expand all sections")
        if ex:
            try: ex.click(); time.sleep(2)
            except Exception: pass

        # dump candidate clickable elements
        data = page.evaluate("""() => {
            const out=[];
            const els=document.querySelectorAll('button, a, [role=button], input[type=button], span[onclick], div[onclick]');
            els.forEach(e=>{
                const t=(e.innerText||e.value||'').trim().slice(0,40);
                const cls=(e.className||'').toString().slice(0,60);
                if(/upload|attach|add|document|resume|cover|\\+/i.test(t+' '+cls+' '+(e.id||'')) ){
                    out.push({tag:e.tagName, text:t, id:e.id, cls:cls,
                              aria:e.getAttribute('aria-label')||'', title:e.getAttribute('title')||''});
                }
            });
            return out;
        }""")
        log("[buttons] "+json.dumps(data, indent=1)[:3000])

        # HTML around 'Upload a Resume'
        html = page.evaluate("""() => {
            const walk=document.evaluate("//*[contains(text(),'Upload a Resume')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;
            if(!walk) return 'NOT FOUND';
            let n=walk; for(let i=0;i<4 && n.parentElement;i++) n=n.parentElement;
            return n.outerHTML.slice(0,1500);
        }""")
        log("[html-around-CV]\\n"+html)
        page.screenshot(path=str(RECON/"probe.png"), full_page=True)
        log("[done] probe screenshot saved")
        time.sleep(2400); ctx.close()

if __name__=="__main__": main()
