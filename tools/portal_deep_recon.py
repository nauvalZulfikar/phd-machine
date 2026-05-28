"""Deeper portal recon — follows apply link, maps form fields, no data entry."""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PHD_APPS = REPO_ROOT / "phd-applications"

PORTALS = [
    ("ukp-intertext",         "https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment"),
    ("copenhagen-mechinterp", "https://employment.ku.dk/phd/?show=160571"),
    ("aarhus-tta",            "https://phd.tech.au.dk/for-applicants/apply-here/saeropslag/phd-position-in-test-time-adaptation-and-agentic-ai"),
    ("aalborg-llm-security",  "https://www.stillinger.aau.dk/vis-stilling/?vacancy=1410023"),
    ("chalmers-agentic-monitoring", "https://www.chalmers.se/en/about-chalmers/work-with-us/vacancies/"),
]

APPLY_LINK_TEXTS = [
    "apply", "apply now", "apply online", "submit application",
    "ansøg", "ansøg her", "søg stillingen",
    "bewerben", "jetzt bewerben",
    "ansök", "ansök här",
    "candidarsi", "candidati",
]

COOKIE_TEXTS = [
    "Accept all", "Accept", "Agree", "Allow all", "OK",
    "Acceptér alle", "Acceptér", "Godkend", "Tillad alle",
    "Akzeptieren", "Alle akzeptieren", "Zustimmen",
    "Accetta", "Accetta tutti",
    "Aceptar", "Tout accepter",
]


def dismiss_cookies(page):
    for txt in COOKIE_TEXTS:
        try:
            loc = page.get_by_role("button", name=txt, exact=False)
            if loc.count():
                loc.first.click(timeout=1500)
                return txt
        except Exception:
            continue
    return None


def find_apply_link(page):
    """Return a Playwright locator for the 'apply' link, or None."""
    for txt in APPLY_LINK_TEXTS:
        for role in ("link", "button"):
            try:
                loc = page.get_by_role(role, name=re.compile(rf"^{txt}\b", re.I))
                if loc.count():
                    return loc.first, txt, role
            except Exception:
                continue
    # Fallback: text-based
    for txt in APPLY_LINK_TEXTS:
        try:
            loc = page.get_by_text(re.compile(rf"\b{txt}\b", re.I))
            if loc.count():
                return loc.first, txt, "text"
        except Exception:
            continue
    return None, None, None


def dump_form_summary(page) -> dict:
    """Capture all visible labels + inputs."""
    js = """() => {
        const out = { inputs: [], selects: [], textareas: [], file_inputs: [], submit_buttons: [] };
        document.querySelectorAll('input, select, textarea').forEach(el => {
            const tag = el.tagName.toLowerCase();
            const type = (el.type || '').toLowerCase();
            const name = el.name || el.id || el.getAttribute('aria-label') || '';
            let label = '';
            if (el.id) {
                const lab = document.querySelector(`label[for='${el.id}']`);
                if (lab) label = lab.innerText.trim();
            }
            if (!label && el.parentElement) {
                const lab = el.parentElement.querySelector('label');
                if (lab) label = lab.innerText.trim();
            }
            const required = el.required || el.getAttribute('aria-required') === 'true';
            const placeholder = el.placeholder || '';
            const entry = { tag, type, name, label, required, placeholder };
            if (type === 'file') out.file_inputs.push(entry);
            else if (tag === 'select') out.selects.push(entry);
            else if (tag === 'textarea') out.textareas.push(entry);
            else if (['submit', 'button'].includes(type)) {
                out.submit_buttons.push({ ...entry, text: el.value || el.innerText });
            } else if (['text', 'email', 'tel', 'date', 'number', 'url', 'password', ''].includes(type)) {
                out.inputs.push(entry);
            }
        });
        document.querySelectorAll('button[type="submit"], button:not([type])').forEach(el => {
            out.submit_buttons.push({ tag: 'button', type: el.type || 'submit', text: el.innerText.trim() });
        });
        return out;
    }"""
    try:
        return page.evaluate(js)
    except Exception as e:
        return {"error": str(e)}


def recon(opp_id: str, url: str):
    out_dir = PHD_APPS / opp_id / "portal_recon"
    out_dir.mkdir(parents=True, exist_ok=True)

    record = {"opp_id": opp_id, "url": url, "steps": [], "blockers": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            ignore_https_errors=True,
            viewport={"width": 1366, "height": 900},
        )
        page = context.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except PWTimeoutError:
                pass
            time.sleep(1.0)

            ck = dismiss_cookies(page)
            if ck:
                time.sleep(1.5)
            page.screenshot(path=str(out_dir / "10_apply_landing.png"), full_page=True)
            record["steps"].append({"step": "landing", "url": page.url, "title": page.title(), "cookie": ck})

            apply_loc, apply_txt, apply_role = find_apply_link(page)
            if apply_loc:
                pre_url = page.url
                try:
                    # Try opening in same tab to follow flow
                    with page.expect_navigation(timeout=10000, wait_until="domcontentloaded"):
                        apply_loc.click(timeout=5000)
                except PWTimeoutError:
                    pass
                except Exception as e:
                    record["steps"].append({"step": "apply-click-error", "error": str(e)})
                time.sleep(2.0)
                try:
                    page.wait_for_load_state("networkidle", timeout=8000)
                except PWTimeoutError:
                    pass
                post_url = page.url
                page.screenshot(path=str(out_dir / "20_after_apply.png"), full_page=True)
                record["steps"].append({
                    "step": "after-apply",
                    "from": pre_url, "to": post_url,
                    "clicked": f"{apply_txt} ({apply_role})",
                    "title": page.title(),
                })
            else:
                record["blockers"].append("NO-APPLY-LINK-FOUND: landing page has no obvious apply button/link")

            # Dump form summary on current page
            summary = dump_form_summary(page)
            record["form_summary"] = summary

            # Detect login wall by URL or form
            url_lower = page.url.lower()
            login_keywords = ["login", "signin", "sign-in", "auth", "openid"]
            if any(k in url_lower for k in login_keywords):
                record["blockers"].append(f"LOGIN-WALL-VIA-URL: redirected to '{page.url}'")
            n_password = page.locator("input[type='password']").count()
            if n_password > 0:
                record["blockers"].append(f"LOGIN-WALL-PASSWORD-INPUT: {n_password} password field(s) on form")

            n_files = len(summary.get("file_inputs", []))
            n_required = sum(1 for entry in summary.get("inputs", []) + summary.get("textareas", []) + summary.get("selects", []) if entry.get("required"))
            n_total = len(summary.get("inputs", [])) + len(summary.get("textareas", [])) + len(summary.get("selects", [])) + n_files
            record["counts"] = {"total_fields": n_total, "required_fields": n_required, "file_uploads": n_files}

            if n_total == 0 and not record["blockers"]:
                record["blockers"].append("NO-FORM-VISIBLE: current page still shows description, may need account/login flow")

            browser.close()
        except Exception as e:
            record["error"] = f"{type(e).__name__}: {e}"

    (out_dir / "deep_structure.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

    # Update BLOCKERS.md (append deep findings)
    lines = [
        "",
        "## Deep recon (after Apply-link follow)",
    ]
    for s in record["steps"]:
        lines.append(f"- **{s['step']}**: {s.get('title') or s.get('url')}")
        if s.get("from"):
            lines.append(f"  - from `{s['from']}`")
            lines.append(f"  - to `{s['to']}`")
            lines.append(f"  - clicked: {s.get('clicked')}")

    c = record.get("counts", {})
    lines.append("")
    lines.append(f"**Form snapshot after apply-link:** {c.get('total_fields', 0)} fields total, {c.get('required_fields', 0)} required, {c.get('file_uploads', 0)} file-upload inputs.")
    lines.append("")
    if record["blockers"]:
        lines.append("### Blockers found")
        for b in record["blockers"]:
            lines.append(f"- ⚠️ {b}")
    else:
        lines.append("### No automated blockers detected at this depth")

    # Append form field list if present
    summary = record.get("form_summary", {})
    if summary and not summary.get("error"):
        fields = summary.get("inputs", []) + summary.get("textareas", []) + summary.get("selects", []) + summary.get("file_inputs", [])
        if fields:
            lines.append("")
            lines.append("### Form fields visible")
            lines.append("| Name/ID | Type | Label | Required |")
            lines.append("|---|---|---|---|")
            for f in fields[:30]:
                nm = (f.get("name") or "—")[:40]
                ty = f.get("type") or f.get("tag")
                lab = (f.get("label") or f.get("placeholder") or "")[:60]
                req = "✓" if f.get("required") else ""
                lines.append(f"| `{nm}` | {ty} | {lab} | {req} |")

    existing = (out_dir / "BLOCKERS.md").read_text(encoding="utf-8") if (out_dir / "BLOCKERS.md").exists() else ""
    (out_dir / "BLOCKERS.md").write_text(existing + "\n".join(lines) + "\n", encoding="utf-8")

    return record


def main():
    summary = []
    for opp_id, url in PORTALS:
        print(f"\n[deep-recon] {opp_id}")
        r = recon(opp_id, url)
        c = r.get("counts", {})
        if r.get("error"):
            print(f"   🔴 {r['error']}")
        else:
            print(f"   steps={len(r['steps'])}  fields={c.get('total_fields', 0)}  required={c.get('required_fields', 0)}  uploads={c.get('file_uploads', 0)}")
        for b in r.get("blockers", []):
            print(f"      ⚠️ {b}")
        summary.append(r)

    # Master
    mlines = ["# Portal Deep Recon — Master", "", "| Opp | Steps | Fields | Required | Uploads | Blockers |", "|---|---|---|---|---|---|"]
    for r in summary:
        c = r.get("counts", {})
        mlines.append(f"| {r['opp_id']} | {len(r['steps'])} | {c.get('total_fields', 0)} | {c.get('required_fields', 0)} | {c.get('file_uploads', 0)} | {len(r.get('blockers', []))} |")
    out = PHD_APPS / "_portal_recon" / "MASTER_DEEP.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(mlines) + "\n", encoding="utf-8")
    print(f"\n[deep-recon] Master → {out}")


if __name__ == "__main__":
    main()
