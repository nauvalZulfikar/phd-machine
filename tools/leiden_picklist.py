#!/usr/bin/env python3
"""Fill the 3 remaining SF dropdowns (Gender / Communication language / How did you hear).
For each: locate by label, dispatch-click the 'No Selection' trigger, dump the option list,
select the target option (or best match)."""
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

def set_dropdown(page, label_kw, want_list):
    # find the picklist input whose label contains label_kw, derive its base id
    info=page.evaluate("""(kw)=>{
        const labs=[...document.querySelectorAll('label')];
        for(const l of labs){
            if((l.innerText||'').toLowerCase().includes(kw)){
                const f=l.getAttribute('for'); if(!f) continue;
                const base=f.split(':')[0];
                return {base, forId:f};
            }
        } return null;
    }""", label_kw)
    if not info: log(f"[{label_kw}] label not found"); return False
    base=info["base"]; log(f"[{label_kw}] base id={base}")
    # dispatch-click the value label / trigger to open the list
    page.evaluate("""(b)=>{
        const ids=[b+':_valueLabel', b+':_input', b+':_arrow', b+':_picklistArrow', b+':'];
        for(const id of ids){const e=document.getElementById(id); if(e){
            e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
            e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); }}
    }""", base)
    time.sleep(1.2)
    # dump visible options
    opts=page.evaluate("""()=>{
        const o=[...document.querySelectorAll('li,[role=option],.dropdownList a,.picklistOption')]
          .filter(e=>e.offsetParent && (e.innerText||'').trim());
        return o.map(e=>({t:(e.innerText||'').trim().slice(0,30), id:e.id||'', cls:(e.className||'').slice(0,30)})).slice(0,40);
    }""")
    log(f"[{label_kw}] options: {json.dumps(opts)[:1200]}")
    # pick option matching any want
    for want in want_list:
        ok=page.evaluate("""(w)=>{
            const o=[...document.querySelectorAll('li,[role=option],.dropdownList a,.picklistOption')]
              .filter(e=>e.offsetParent && (e.innerText||'').trim());
            for(const e of o){ if((e.innerText||'').trim().toLowerCase()===w.toLowerCase()){
                e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
                e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); return true;}}
            for(const e of o){ if((e.innerText||'').trim().toLowerCase().includes(w.toLowerCase())){
                e.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
                e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); return true;}}
            return false;
        }""", want)
        if ok: log(f"[{label_kw}] selected '{want}'"); time.sleep(1); return True
    log(f"[{label_kw}] no match for {want_list}"); return False

def main():
    with sync_playwright() as pw:
        ctx=pw.chromium.launch_persistent_context(user_data_dir=str(PDIR), headless=False,
            viewport={"width":1400,"height":950}, args=["--disable-blink-features=AutomationControlled"])
        page=ctx.pages[0] if ctx.pages else ctx.new_page()
        log(f"[reach]{reach(page)}")
        page.evaluate("""()=>{document.querySelectorAll('[aria-expanded=false]').forEach(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,view:window})));}""")
        time.sleep(2)
        set_dropdown(page,"gender",["Male"])
        set_dropdown(page,"communication language",["English"])
        set_dropdown(page,"how did you hear",["Website","AcademicTransfer","Academic Transfer","University website","Other","Job board"])
        time.sleep(2)
        page.screenshot(path=str(RECON/"picklists.png"), full_page=True)
        log("[done]")
        time.sleep(3000); ctx.close()
if __name__=="__main__": main()
