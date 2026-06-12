#!/usr/bin/env python3
"""Deep probe: reach Leiden form, expand ALL sections, then dump (1) full HTML of each
attach widget and (2) every input/select/textarea with label+value+required+visible."""
import os, time, pathlib, re, json
from playwright.sync_api import sync_playwright

PHD=pathlib.Path.home()/"coding-projects"/"phd"; OPP="leiden-formal-nlp"
URL="https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
PDIR=PHD/".browser-profiles"/OPP; RECON=PHD/"in-process"/OPP/"portal_recon"
REG_PW=os.environ.get("PHD_REG_PW","")
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
        except Exception as e:
            log(f"[reach warn] {str(e)[:40]}"); time.sleep(2)
    return False

def main():
    RECON.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach] {reach(page)}")
        for sel in ["text=Expand all sections","a:has-text('Expand all')"]:
            b=page.query_selector(sel)
            if b:
                try: b.click(); time.sleep(2)
                except Exception: pass
                break
        for label in ["Profile Information","Job-Specific Information","Personal Information"]:
            b=page.query_selector(f"button:has-text('{label}')") or page.query_selector(f"text={label}")
            if b:
                try: b.click(); time.sleep(1.2)
                except Exception: pass

        # (1) attach widgets full html
        for fid in ["66","68","70","72"]:
            html=page.evaluate("(f)=>{const e=document.getElementById(f+':_attach');return e?e.outerHTML:'NONE'}", fid)
            log(f"[attach {fid}]\n{html[:2200]}\n----")

        # (2) all form fields
        fields=page.evaluate("""() => {
            const esc=(s)=>{try{return CSS.escape(s)}catch(e){return s}};
            const out=[];
            document.querySelectorAll('input,select,textarea').forEach(e=>{
                if(['hidden','submit','button'].includes(e.type)) return;
                let label='';
                if(e.id){const l=document.querySelector('label[for=\"'+esc(e.id)+'\"]'); if(l) label=(l.innerText||'').trim();}
                if(!label) label=(e.getAttribute('aria-label')||e.placeholder||'');
                let opts='';
                if(e.tagName==='SELECT'){opts=[...e.options].map(o=>o.text).slice(0,8).join('|');}
                out.push({tag:e.tagName,type:e.type||'',id:e.id||'',name:e.name||'',
                    label:label.slice(0,55),value:(e.value||'').slice(0,30),
                    req:(e.required||e.getAttribute('aria-required')==='true')?1:0,
                    vis:!!(e.offsetParent), opts:opts});
            });
            return out;
        }""")
        log("[FIELDS]\n"+json.dumps(fields, indent=0))
        page.screenshot(path=str(RECON/"probe2.png"), full_page=True)
        log("[done]")
        time.sleep(2400); ctx.close()

if __name__=="__main__": main()
