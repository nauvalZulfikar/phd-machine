"""Universal PDF builder — config-driven, per-app.

Usage:
    python tools/build_pdfs.py data/academic/apps/<opp-id>

Reads <opp-id>/BUILD_CONFIG.yaml; renders each declared doc through Playwright
with the named template; verifies size + page count; writes to <opp-id>/documents/.
"""

from __future__ import annotations

import asyncio
import base64
import re
import sys
from pathlib import Path

import yaml
from markdown_it import MarkdownIt
from playwright.async_api import async_playwright

sys.stdout.reconfigure(encoding="utf-8")

try:
    from pypdf import PdfReader
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = REPO_ROOT / "templates"
KNOWLEDGE_ASSETS = REPO_ROOT / "data" / "knowledge" / "assets"


HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>{title}</title><style>{css}</style></head>
<body>{body}</body>
</html>
"""


def strip_yaml_front_matter(text: str) -> str:
    return re.sub(r"^---[\s\S]*?\n---\n", "", text, count=1)


def inline_assets(html: str, search_paths: list[Path]) -> str:
    """Inline SVGs and base64-encode raster images. Try each search path until found."""

    def find(src: str) -> Path | None:
        for d in search_paths:
            p = d / src
            if p.exists():
                return p
        return None

    def _replace_svg(match: re.Match) -> str:
        src = match.group(1)
        p = find(src)
        if p is None:
            return match.group(0)
        svg = p.read_text(encoding="utf-8")
        svg = re.sub(r"<\?xml[^?]*\?>\s*", "", svg)
        return f'<figure style="margin:14pt 0;text-align:center">{svg}</figure>'

    html = re.sub(
        r'<img[^>]*src=["\']([^"\']+\.svg)["\'][^>]*/?>',
        _replace_svg, html,
    )

    def _replace_raster(match: re.Match) -> str:
        full = match.group(0)
        src = match.group(1)
        p = find(src)
        if p is None:
            return full
        ext = p.suffix.lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "gif": "gif"}.get(ext, ext)
        data = base64.b64encode(p.read_bytes()).decode("ascii")
        data_uri = f"data:image/{mime};base64,{data}"
        return re.sub(r'src=["\'][^"\']+["\']', f'src="{data_uri}"', full)

    return re.sub(
        r'<img[^>]*src=["\']([^"\']+\.(?:jpg|jpeg|png|gif))["\'][^>]*/?>',
        _replace_raster, html, flags=re.IGNORECASE,
    )


def md_to_html(md_text: str, search_paths: list[Path]) -> str:
    md_text = strip_yaml_front_matter(md_text)
    md = MarkdownIt("commonmark", {"breaks": False, "html": True}).enable(["table", "strikethrough"])
    html = md.render(md_text)
    return inline_assets(html, search_paths)


def margins_to_dict(m: dict) -> dict:
    """yaml margins might be {top:25mm,...} as strings or as int mm. Normalize to strings."""
    out = {}
    for k in ("top", "bottom", "left", "right"):
        v = m.get(k, "25mm")
        out[k] = v if isinstance(v, str) else f"{v}mm"
    return out


def verify(pdf_path: Path, max_size_mb: float | None, max_pages: int | None) -> list[str]:
    issues = []
    size_mb = pdf_path.stat().st_size / (1024 * 1024)
    if max_size_mb and size_mb > max_size_mb:
        issues.append(f"size {size_mb:.2f} MB > limit {max_size_mb} MB")
    if max_pages and HAS_PYPDF:
        n = len(PdfReader(str(pdf_path)).pages)
        if n > max_pages:
            issues.append(f"pages {n} > limit {max_pages}")
    return issues


async def render_one(
    src_md: Path,
    out_pdf: Path,
    title: str,
    css: str,
    margins: dict,
    extra_search_paths: list[Path],
) -> None:
    md_text = src_md.read_text(encoding="utf-8")
    search_paths = [src_md.parent] + extra_search_paths
    body = md_to_html(md_text, search_paths)
    html = HTML_TEMPLATE.format(title=title, css=css, body=body)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="load")
        await page.pdf(path=str(out_pdf), format="A4", print_background=True, margin=margins)
        await browser.close()


async def main(app_dir: Path) -> None:
    cfg_path = app_dir / "BUILD_CONFIG.yaml"
    if not cfg_path.exists():
        print(f"ERROR: {cfg_path} not found")
        sys.exit(1)
    cfg = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))

    template_name = cfg.get("template", "default")
    template_dir = TEMPLATES_DIR / template_name
    if not template_dir.exists():
        print(f"ERROR: template '{template_name}' not found at {template_dir}")
        sys.exit(1)
    template_cfg = yaml.safe_load((template_dir / "config.yaml").read_text(encoding="utf-8"))

    full_css = (template_dir / "full.css").read_text(encoding="utf-8")
    cv_css   = (template_dir / "cv.css").read_text(encoding="utf-8")

    out_dir = app_dir / "documents"
    out_dir.mkdir(parents=True, exist_ok=True)

    filename_pattern = cfg.get("filename_pattern", "{doc}.pdf")
    max_size_mb = cfg.get("max_file_size_mb")
    max_pages_default = cfg.get("max_pages", {})

    extra_search = [app_dir / "drafts", KNOWLEDGE_ASSETS]

    print(f"App:      {app_dir}")
    print(f"Template: {template_name} (photo_in_cv={template_cfg.get('photo_in_cv')})")
    print(f"Output:   {out_dir}")
    print(f"{'-' * 60}")

    any_issue = False
    for doc in cfg["docs"]:
        name = doc["name"]
        src = app_dir / doc["source"]
        kind = doc.get("kind", "full")
        title = doc.get("title", name.replace("_", " ").title())

        if not src.exists():
            print(f"  MISSING: {src}")
            any_issue = True
            continue

        css = cv_css if kind == "cv" else full_css
        margins = margins_to_dict(
            template_cfg["margins_cv"] if kind == "cv" else template_cfg["margins_full"]
        )

        out_name = filename_pattern.format(doc=name)
        out_pdf = out_dir / out_name

        await render_one(src, out_pdf, title, css, margins, extra_search)

        size_kb = out_pdf.stat().st_size / 1024
        max_p = doc.get("max_pages") or max_pages_default.get(name)
        issues = verify(out_pdf, max_size_mb, max_p)
        status = " " + ("FAIL " + "; ".join(issues) if issues else "OK")
        any_issue = any_issue or bool(issues)
        pages_str = ""
        if HAS_PYPDF:
            n = len(PdfReader(str(out_pdf)).pages)
            pages_str = f" {n}p"
        print(f"  {out_name:50s} {size_kb:6.0f} KB{pages_str} {status}")

    print(f"{'-' * 60}")
    print(f"Done. {'(some issues — see above)' if any_issue else 'all clean.'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tools/build_pdfs.py <app-dir>")
        sys.exit(1)
    app_dir = Path(sys.argv[1]).resolve()
    asyncio.run(main(app_dir))
