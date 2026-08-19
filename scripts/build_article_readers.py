#!/usr/bin/env python3
"""Build local HTML/PDF readers for fetched WeChat article Markdown files."""

from __future__ import annotations

import argparse
import html
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from urllib.parse import quote


IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)(?:\{[^}]*\})?")
URL_RE = re.compile(r"(https?://[^\s<]+)")


def safe_print(text: str) -> None:
    print(str(text).encode(sys.stdout.encoding or "utf-8", errors="replace").decode(sys.stdout.encoding or "utf-8", errors="replace"))


def chrome_candidates() -> list[Path]:
    env = os.environ
    candidates = [
        Path(env.get("ProgramFiles", "")) / "Google/Chrome/Application/chrome.exe",
        Path(env.get("ProgramFiles(x86)", "")) / "Google/Chrome/Application/chrome.exe",
        Path(env.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
        Path(env.get("ProgramFiles", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(env.get("ProgramFiles(x86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        Path(env.get("LOCALAPPDATA", "")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    for name in ("chrome", "chrome.exe", "msedge", "msedge.exe"):
        found = shutil.which(name)
        if found:
            candidates.append(Path(found))
    return [path for path in candidates if path and path.exists()]


def file_url(path: Path) -> str:
    return path.resolve().as_uri()


def reader_image_src(markdown_image_path: str) -> str:
    markdown_image_path = html.unescape(markdown_image_path.strip()).replace("\\", "/")
    if markdown_image_path.startswith(("http://", "https://", "data:")):
        return markdown_image_path
    return f"../{markdown_image_path}"


def image_html(match: re.Match[str]) -> str:
    alt = html.escape(match.group(1) or "")
    src = html.escape(reader_image_src(match.group(2)), quote=True)
    return f'<figure><img src="{src}" alt="{alt}" loading="lazy" /></figure>'


def inline_markup(text: str) -> str:
    text = re.sub(r"\{data-source-line=\d+\}", "", text)
    pieces: list[str] = []
    last = 0
    for match in IMAGE_RE.finditer(text):
        pieces.append(html.escape(text[last:match.start()]))
        pieces.append(image_html(match))
        last = match.end()
    pieces.append(html.escape(text[last:]))
    rendered = "".join(pieces)
    rendered = URL_RE.sub(lambda m: f'<a href="{html.escape(m.group(1), quote=True)}" target="_blank" rel="noopener">{html.escape(m.group(1))}</a>', rendered)
    return rendered


def markdown_to_html(markdown: str) -> str:
    lines = markdown.splitlines()
    blocks: list[str] = []
    list_items: list[str] = []
    paragraph: list[str] = []

    def flush_list() -> None:
        nonlocal list_items
        if list_items:
            blocks.append("<ul>" + "".join(list_items) + "</ul>")
            list_items = []

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            blocks.append(f"<p>{inline_markup(' '.join(paragraph))}</p>")
            paragraph = []

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line.strip():
            flush_paragraph()
            flush_list()
            continue

        if line.startswith("# "):
            flush_paragraph()
            flush_list()
            blocks.append(f"<h1>{inline_markup(line[2:].strip())}</h1>")
            continue

        if line.startswith("## "):
            flush_paragraph()
            flush_list()
            blocks.append(f"<h2>{inline_markup(line[3:].strip())}</h2>")
            continue

        if line.startswith("- "):
            flush_paragraph()
            list_items.append(f"<li>{inline_markup(line[2:].strip())}</li>")
            continue

        if IMAGE_RE.fullmatch(line.strip()):
            flush_paragraph()
            flush_list()
            blocks.append(IMAGE_RE.sub(image_html, line.strip()))
            continue

        paragraph.append(line.strip())

    flush_paragraph()
    flush_list()
    return "\n".join(blocks)


def page_html(title: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(title)}</title>
    <style>
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        color: #202724;
        background: #f7f3e8;
        font-family: "Noto Serif SC", "Microsoft YaHei", "PingFang SC", Georgia, serif;
        line-height: 1.78;
      }}
      main {{
        width: min(820px, calc(100% - 32px));
        margin: 0 auto;
        padding: 42px 0 64px;
      }}
      h1 {{
        margin: 0 0 22px;
        color: #17201d;
        font-size: 30px;
        line-height: 1.25;
      }}
      h2 {{
        margin: 34px 0 14px;
        font-size: 22px;
      }}
      p {{
        margin: 0 0 18px;
        font-size: 16px;
      }}
      ul {{
        margin: 0 0 26px;
        padding: 14px 18px 14px 30px;
        border: 1px solid #ddd4c0;
        background: rgba(255, 250, 240, 0.72);
      }}
      li {{ margin: 4px 0; }}
      a {{ color: #176f62; word-break: break-all; }}
      figure {{
        margin: 22px 0;
        break-inside: avoid;
      }}
      img {{
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
        border: 1px solid rgba(92, 74, 47, 0.14);
        background: #fffaf0;
      }}
      @page {{ margin: 16mm 14mm; }}
      @media print {{
        body {{ background: #fff; }}
        main {{ width: 100%; padding: 0; }}
        a {{ color: #174f45; text-decoration: none; }}
      }}
    </style>
  </head>
  <body>
    <main>
{body}
    </main>
  </body>
</html>
"""


def article_title(markdown: str, stem: str) -> str:
    for line in markdown.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return stem


def build_html(md_path: Path, html_path: Path) -> str:
    markdown = md_path.read_text(encoding="utf-8", errors="replace")
    title = article_title(markdown, md_path.stem)
    body = markdown_to_html(markdown)
    html_path.parent.mkdir(parents=True, exist_ok=True)
    html_path.write_text(page_html(title, body), encoding="utf-8")
    return title


def print_pdf(browser: Path, html_path: Path, pdf_path: Path) -> None:
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"--print-to-pdf={pdf_path.resolve()}",
        file_url(html_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build local HTML/PDF readers for fetched article Markdown files.")
    parser.add_argument("--input", default="exports/wechat_articles", help="directory containing article Markdown files")
    parser.add_argument("--limit", type=int, default=0, help="maximum number of articles to process; 0 means all")
    parser.add_argument("--skip-pdf", action="store_true", help="only build HTML readers")
    parser.add_argument("--force", action="store_true", help="rebuild existing HTML/PDF files")
    args = parser.parse_args()

    article_dir = Path(args.input)
    md_files = sorted(article_dir.glob("*.md"))
    if args.limit:
        md_files = md_files[: args.limit]

    reader_dir = article_dir / "readers"
    pdf_dir = article_dir / "pdfs"
    browsers = chrome_candidates()
    browser = browsers[0] if browsers else None
    if not args.skip_pdf and not browser:
        print("No Chrome/Edge executable found; only HTML readers will be generated.", file=sys.stderr)

    for index, md_path in enumerate(md_files, start=1):
        html_path = reader_dir / f"{md_path.stem}.html"
        pdf_path = pdf_dir / f"{md_path.stem}.pdf"
        if args.force or not html_path.exists():
            title = build_html(md_path, html_path)
        else:
            title = md_path.stem

        if not args.skip_pdf and browser and (args.force or not pdf_path.exists()):
            print_pdf(browser, html_path, pdf_path)

        pdf_status = "pdf" if pdf_path.exists() else "html"
        safe_print(f"[{index}/{len(md_files)}] {pdf_status} {title}")

    safe_print(f"Done. HTML: {reader_dir} PDF: {pdf_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
