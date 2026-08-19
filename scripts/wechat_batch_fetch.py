#!/usr/bin/env python3
"""Batch-fetch WeChat public-account articles from a saved link page.

The script extracts mp.weixin.qq.com article links from a local HTML file,
fetches each article politely, and writes one Markdown file plus one JSON
metadata file per article.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import re
from pathlib import Path
import time
from collections.abc import Callable
from typing import Iterable
from urllib import error, parse, request


ARTICLE_URL_RE = re.compile(r"https?://mp\.weixin\.qq\.com/s(?:\?|/)[^\s\"'<>]+", re.I)
ATTR_URL_RE = re.compile(r"""(?:href|data-link|data-url)=["']([^"']+)["']""", re.I)


def strip_fragment(url: str) -> str:
    parts = parse.urlsplit(url)
    return parse.urlunsplit(("https", parts.netloc, parts.path, parts.query, ""))


def canonical_key(url: str) -> str:
    parts = parse.urlsplit(url)
    query = parse.parse_qs(parts.query)
    values = [query.get(name, [""])[0] for name in ("__biz", "mid", "idx", "sn")]
    if any(values):
      return "|".join(values)
    return strip_fragment(url)


def extract_article_urls(source_html: str) -> list[str]:
    candidates: list[str] = []

    for match in ATTR_URL_RE.finditer(source_html):
        value = html.unescape(match.group(1))
        if "mp.weixin.qq.com/s" in value:
            candidates.append(value)

    for match in ARTICLE_URL_RE.finditer(source_html):
        candidates.append(html.unescape(match.group(0)))

    seen: set[str] = set()
    urls: list[str] = []
    for raw_url in candidates:
        if "${" in raw_url:
            continue
        url = strip_fragment(raw_url)
        key = canonical_key(url)
        if key in seen:
            continue
        seen.add(key)
        urls.append(url)
    return urls


def first_match(patterns: Iterable[str], text: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.I | re.S)
        if match:
            return clean_inline_text(match.group(1))
    return ""


def clean_inline_text(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def extract_article_body(raw_html: str) -> str:
    match = re.search(
        r"""<div[^>]+id=["']js_content["'][^>]*>(.*?)</div>\s*</div>\s*<script""",
        raw_html,
        re.I | re.S,
    )
    if not match:
        match = re.search(r"""<div[^>]+id=["']js_content["'][^>]*>(.*?)</div>""", raw_html, re.I | re.S)
    return match.group(1) if match else ""


class ArticleTextParser(HTMLParser):
    block_tags = {
        "address",
        "article",
        "aside",
        "blockquote",
        "br",
        "div",
        "figcaption",
        "figure",
        "footer",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "header",
        "li",
        "p",
        "section",
        "table",
        "td",
        "th",
        "tr",
        "ul",
        "ol",
    }

    def __init__(self, image_resolver: Callable[[str], str] | None = None) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.link_stack: list[str] = []
        self.image_resolver = image_resolver

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = {key.lower(): value or "" for key, value in attrs}
        if tag in self.block_tags:
            self._newline()
        if tag == "a":
            href = html.unescape(attrs_map.get("href") or attrs_map.get("data-link") or "")
            self.link_stack.append(href)
        if tag == "img":
            alt = clean_inline_text(attrs_map.get("alt") or "")
            src = attrs_map.get("data-src") or attrs_map.get("src") or attrs_map.get("data-backsrc") or ""
            if self.image_resolver and src:
                src = self.image_resolver(src)
            if alt:
                self.parts.append(f"![{alt}]({src})")
            elif src:
                self.parts.append(f"![]({src})")
            self._newline()

    def handle_endtag(self, tag: str) -> None:
        if tag == "a":
            href = self.link_stack.pop() if self.link_stack else ""
            if href and "mp.weixin.qq.com/s" not in href:
                self.parts.append(f" ({href})")
        if tag in self.block_tags:
            self._newline()

    def handle_data(self, data: str) -> None:
        text = re.sub(r"\s+", " ", data)
        if text.strip():
            self.parts.append(text)

    def _newline(self) -> None:
        if self.parts and not self.parts[-1].endswith("\n\n"):
            self.parts.append("\n\n")

    def markdown(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def html_to_markdown(article_html: str, image_resolver: Callable[[str], str] | None = None) -> str:
    parser = ArticleTextParser(image_resolver=image_resolver)
    parser.feed(article_html)
    return parser.markdown()


def parse_article(raw_html: str, url: str) -> dict[str, str]:
    title = first_match(
        [
            r"""property=["']og:title["']\s+content=["']([^"']+)["']""",
            r"""id=["']activity-name["'][^>]*>(.*?)</[^>]+>""",
            r"""<title>(.*?)</title>""",
        ],
        raw_html,
    )
    author = first_match(
        [
            r"""id=["']js_name["'][^>]*>(.*?)</[^>]+>""",
            r"""property=["']og:article:author["']\s+content=["']([^"']*)["']""",
        ],
        raw_html,
    )
    publish_time = first_match(
        [
            r"""id=["']publish_time["'][^>]*>(.*?)</[^>]+>""",
            r"""var\s+ct\s*=\s*["'](\d+)["']""",
        ],
        raw_html,
    )
    description = first_match(
        [
            r"""name=["']description["']\s+content=["']([^"']*)["']""",
            r"""property=["']og:description["']\s+content=["']([^"']*)["']""",
        ],
        raw_html,
    )
    article_html = extract_article_body(raw_html)
    return {
        "url": url,
        "title": title or "未命名文章",
        "author": author,
        "publish_time": publish_time,
        "description": description,
        "article_html": article_html,
    }


def safe_filename(title: str, index: int, url: str) -> str:
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    cleaned = re.sub(r'[\\/:*?"<>|]+', " ", title)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = cleaned[:72] or "wechat-article"
    return f"{index:03d}-{cleaned}-{digest}"


def fetch_url(url: str, timeout: int, retries: int) -> tuple[int, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = request.Request(url, headers=headers)
            with request.urlopen(req, timeout=timeout) as response:
                charset = response.headers.get_content_charset() or "utf-8"
                body = response.read().decode(charset, errors="replace")
                return response.status, body
        except (error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def image_extension(url: str, content_type: str) -> str:
    query = parse.parse_qs(parse.urlsplit(url).query)
    for key in ("wx_fmt", "tp", "fmt"):
        value = query.get(key, [""])[0].lower()
        if value:
            if value in {"jpeg", "jpg"}:
                return ".jpg"
            if value in {"png", "gif", "webp", "bmp"}:
                return f".{value}"

    suffix = Path(parse.urlsplit(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
        return ".jpg" if suffix == ".jpeg" else suffix

    content_type = content_type.lower().split(";")[0].strip()
    return {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
    }.get(content_type, ".jpg")


def normalize_asset_url(url: str) -> str:
    url = html.unescape(url).strip()
    if url.startswith("//"):
        return f"https:{url}"
    return url


def fetch_binary(url: str, referer: str, timeout: int, retries: int) -> tuple[bytes, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0 Safari/537.36"
        ),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": referer,
    }
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = request.Request(url, headers=headers)
            with request.urlopen(req, timeout=timeout) as response:
                return response.read(), response.headers.get("Content-Type", "")
        except (error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


class ImageDownloader:
    def __init__(self, output_dir: Path, relative_dir: Path, article_url: str, timeout: int, retries: int) -> None:
        self.output_dir = output_dir
        self.relative_dir = relative_dir
        self.article_url = article_url
        self.timeout = timeout
        self.retries = retries
        self.cache: dict[str, str] = {}
        self.count = 0
        self.failures: list[dict[str, str]] = []

    def localize(self, src: str) -> str:
        url = normalize_asset_url(src)
        if not url or url.startswith("data:"):
            return url

        parts = parse.urlsplit(url)
        if parts.scheme not in {"http", "https"}:
            return url

        if url in self.cache:
            return self.cache[url]

        self.count += 1
        try:
            data, content_type = fetch_binary(url, self.article_url, self.timeout, self.retries)
            ext = image_extension(url, content_type)
            self.output_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{self.count:03d}{ext}"
            (self.output_dir / filename).write_bytes(data)
            local_path = (self.relative_dir / filename).as_posix()
            self.cache[url] = local_path
            return local_path
        except Exception as exc:
            self.failures.append({"url": url, "error": str(exc)})
            self.cache[url] = url
            return url


def write_article(
    out_dir: Path,
    index: int,
    article: dict[str, str],
    download_images: bool,
    images_dir_name: str,
    timeout: int,
    retries: int,
) -> None:
    stem = safe_filename(article["title"], index, article["url"])
    md_path = out_dir / f"{stem}.md"
    json_path = out_dir / f"{stem}.json"
    downloader: ImageDownloader | None = None
    article_html = article.get("article_html", "")
    if download_images and article_html:
        downloader = ImageDownloader(
            output_dir=out_dir / images_dir_name / stem,
            relative_dir=Path(images_dir_name) / stem,
            article_url=article["url"],
            timeout=timeout,
            retries=retries,
        )
    markdown_body = html_to_markdown(article_html, downloader.localize if downloader else None) if article_html else ""
    article["image_count"] = str(downloader.count if downloader else 0)
    article["image_dir"] = (Path(images_dir_name) / stem).as_posix() if downloader and downloader.count else ""
    if downloader and downloader.failures:
        article["image_failures"] = json.dumps(downloader.failures, ensure_ascii=False)
    markdown = [
        f"# {article['title']}",
        "",
        f"- 原文链接: {article['url']}",
        f"- 作者: {article['author'] or '未知'}",
        f"- 发布时间: {article['publish_time'] or '未知'}",
        f"- 图片数量: {article['image_count']}",
        "",
        markdown_body or "> 未能从页面中提取正文，可能需要微信客户端环境或页面结构已变化。",
        "",
    ]
    md_path.write_text("\n".join(markdown), encoding="utf-8")
    json_path.write_text(
        json.dumps({key: value for key, value in article.items() if key != "article_html"}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-fetch WeChat articles from a saved HTML link page.")
    parser.add_argument("--input", default="555天图文快速链接.html", help="saved HTML file containing article links")
    parser.add_argument("--out", default="exports/wechat_articles", help="output directory")
    parser.add_argument("--limit", type=int, default=0, help="maximum number of articles to fetch; 0 means all")
    parser.add_argument("--start", type=int, default=1, help="1-based article index to start from")
    parser.add_argument("--delay", type=float, default=1.2, help="seconds to wait between requests")
    parser.add_argument("--timeout", type=int, default=15, help="request timeout in seconds")
    parser.add_argument("--retries", type=int, default=1, help="retry count per article")
    parser.add_argument("--images-dir", default="images", help="image folder name inside the output directory")
    parser.add_argument("--skip-images", action="store_true", help="do not download images; keep remote image URLs")
    parser.add_argument("--list-only", action="store_true", help="only list extracted article links")
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.out)
    source_html = input_path.read_text(encoding="utf-8", errors="replace")
    all_urls = extract_article_urls(source_html)

    start = max(1, args.start)
    start_index = start - 1
    if start_index >= len(all_urls):
        print(f"Found {len(all_urls)} article links, but --start {start} is out of range.")
        return 1

    if args.limit > 0:
        urls = all_urls[start_index : start_index + args.limit]
    else:
        urls = all_urls[start_index:]

    print(f"Found {len(all_urls)} article links. Selected {len(urls)} link(s) from #{start}.")
    if args.list_only:
        for offset, url in enumerate(urls):
            print(f"{start + offset}: {url}")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    failures: list[dict[str, str]] = []
    for offset, url in enumerate(urls):
        index = start + offset
        print(f"[{offset + 1}/{len(urls)} | #{index}] Fetching {url}")
        try:
            status, raw_html = fetch_url(url, args.timeout, args.retries)
            article = parse_article(raw_html, url)
            article["status"] = str(status)
            write_article(out_dir, index, article, not args.skip_images, args.images_dir, args.timeout, args.retries)
            print(f"  OK {status}: {article['title']} ({article['image_count']} images)")
        except Exception as exc:
            print(f"  FAIL: {exc}")
            failures.append({"url": url, "error": str(exc)})
        if offset + 1 < len(urls):
            time.sleep(max(0, args.delay))

    if failures:
        (out_dir / "failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Done with {len(failures)} failures. See {out_dir / 'failures.json'}.")
        return 1

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
