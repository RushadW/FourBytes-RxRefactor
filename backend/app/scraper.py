"""
Scraper module — fetch policy documents from payer websites.

Each strategy has its own function. The main `scrape_source()` dispatcher
routes to the right strategy based on the payer config.

Returns a list of FetchedDocument objects ready for the ingestion pipeline.
"""
from __future__ import annotations

import hashlib
import re
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

from app.sources import PayerSource, PAYER_SOURCES
from app.storage import get_storage

logger = logging.getLogger(__name__)

# Polite request headers
DEFAULT_HEADERS = {
    "User-Agent": "AntonRx-PolicyTracker/1.0 (hackathon research tool; contact: team@antonrx.dev)",
    "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
}

# Rate limiting — seconds between requests to the same host
REQUEST_DELAY = 1.5


@dataclass
class FetchedDocument:
    """A raw document fetched from a payer source."""
    payer_id: str
    payer_name: str
    source_url: str
    filename: str
    content: bytes
    content_type: str  # pdf | html
    file_hash: str
    fetched_at: datetime
    title: str = ""
    drug_hint: str = ""  # which drug this might be about (from URL/title)
    metadata: dict = field(default_factory=dict)


# ============================================================
# HTTP client with retry + delay
# ============================================================

def _fetch_url(url: str, headers: dict | None = None, timeout: int = 30) -> httpx.Response:
    """Fetch a URL with retry logic and polite delays."""
    hdrs = {**DEFAULT_HEADERS, **(headers or {})}
    for attempt in range(3):
        try:
            with httpx.Client(follow_redirects=True, timeout=timeout, headers=hdrs) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp
        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
            logger.warning(f"Attempt {attempt+1} failed for {url}: {e}")
            if attempt < 2:
                time.sleep(REQUEST_DELAY * (attempt + 1))
            else:
                raise
    raise RuntimeError(f"Failed to fetch {url} after 3 attempts")


def _is_valid_pdf(content: bytes) -> bool:
    """Check if content begins with the PDF magic bytes."""
    return content[:4] == b"%PDF"


def _is_error_page(content: bytes) -> bool:
    """Detect common HTML error pages returned with 200 status."""
    if _is_valid_pdf(content):
        return False
    text = content[:2000].decode("utf-8", errors="ignore").lower()
    return any(kw in text for kw in ["error page", "page not found", "404", "access denied"])


def _try_extract_pdf_from_wrapper(content: bytes, original_url: str) -> bytes | None:
    """Try to extract a real PDF from an HTML wrapper page (e.g. Widen CDN)."""
    try:
        text = content.decode("utf-8", errors="ignore")
        soup = BeautifulSoup(text, "lxml")

        # Widen CDN pattern: replace /pdf/plus/ or /view/pdf/ with /download/
        if "widencdn.net" in original_url:
            download_url = re.sub(r"/(?:pdf/plus|view/pdf)/", "/download/", original_url)
            if download_url != original_url:
                logger.info(f"Trying Widen download URL: {download_url}")
                resp = _fetch_url(download_url, timeout=120)
                if _is_valid_pdf(resp.content):
                    return resp.content

        # Generic: look for download links or meta refreshes pointing to PDFs
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            link_text = a_tag.get_text(strip=True).lower()
            if "download" in link_text or "download" in href.lower():
                full_url = urljoin(original_url, href)
                if full_url != original_url:
                    logger.info(f"Trying download link: {full_url}")
                    resp = _fetch_url(full_url, timeout=120)
                    if _is_valid_pdf(resp.content):
                        return resp.content

        # Meta refresh redirect
        meta = soup.find("meta", attrs={"http-equiv": re.compile(r"refresh", re.I)})
        if meta and meta.get("content"):
            match = re.search(r"url=(.+)", meta["content"], re.I)
            if match:
                redirect_url = urljoin(original_url, match.group(1).strip())
                resp = _fetch_url(redirect_url, timeout=120)
                if _is_valid_pdf(resp.content):
                    return resp.content

    except Exception as e:
        logger.warning(f"Failed to extract PDF from wrapper: {e}")

    return None


def _hash_content(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _guess_drug_from_text(text: str, targets: list[str]) -> str:
    """Try to match a target drug name from a URL or title string."""
    lower = text.lower()
    for drug in targets:
        if drug.lower() in lower:
            return drug.lower()
    return ""


def _sanitize_filename(url: str, payer_id: str) -> str:
    """Create a safe filename from a URL."""
    # Take last path segment
    name = url.rstrip("/").split("/")[-1].split("?")[0]
    if not name or len(name) < 3:
        name = f"{payer_id}_{hashlib.md5(url.encode()).hexdigest()[:8]}"
    # Ensure it has an extension
    if not name.endswith((".pdf", ".html", ".htm")):
        name += ".pdf"
    return name


# ============================================================
# Strategy: index_page_pdf
# Fetch the index page, find PDF links matching target drugs, download them.
# ============================================================

def _scrape_index_page_pdf(source: PayerSource) -> list[FetchedDocument]:
    """Scrape an index page for PDF links and download matching ones."""
    docs: list[FetchedDocument] = []
    logger.info(f"[{source.payer_id}] Fetching index page: {source.index_url}")

    try:
        resp = _fetch_url(source.index_url)
    except Exception as e:
        logger.error(f"[{source.payer_id}] Failed to fetch index page: {e}")
        return docs

    soup = BeautifulSoup(resp.text, "lxml")

    # Find all PDF links
    links: list[dict[str, str]] = []
    selector = source.link_selector or "a[href$='.pdf']"
    for a_tag in soup.select(selector):
        href = a_tag.get("href", "")
        if not href:
            continue
        full_url = urljoin(source.index_url, href)
        link_text = a_tag.get_text(strip=True)
        links.append({"url": full_url, "text": link_text})

    # Also look for links in the page text that might be plain URLs
    if not links:
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if ".pdf" in href.lower():
                full_url = urljoin(source.index_url, href)
                link_text = a_tag.get_text(strip=True)
                links.append({"url": full_url, "text": link_text})

    logger.info(f"[{source.payer_id}] Found {len(links)} PDF links on index page")

    # Filter by target drug pattern
    pattern = source.link_pattern
    if pattern:
        regex = re.compile(pattern)
        filtered = [
            l for l in links
            if regex.search(l["url"]) or regex.search(l["text"])
        ]
    else:
        filtered = links

    logger.info(f"[{source.payer_id}] {len(filtered)} links match target drugs")

    # Download each matching PDF
    for link in filtered:
        time.sleep(REQUEST_DELAY)
        try:
            logger.info(f"[{source.payer_id}] Downloading: {link['url']}")
            pdf_resp = _fetch_url(link["url"])
            content = pdf_resp.content

            # Validate it's actually a PDF (some payers return HTML error pages with 200)
            if not _is_valid_pdf(content):
                if _is_error_page(content):
                    logger.warning(f"[{source.payer_id}] Got error page instead of PDF for {link['url']}")
                    continue
                # Might be a Widen CDN wrapper — try to find download link
                content = _try_extract_pdf_from_wrapper(content, link["url"])
                if content is None:
                    logger.warning(f"[{source.payer_id}] Downloaded non-PDF content from {link['url']}, skipping")
                    continue

            drug_hint = _guess_drug_from_text(
                link["url"] + " " + link["text"],
                source.target_drugs,
            )

            doc = FetchedDocument(
                payer_id=source.payer_id,
                payer_name=source.payer_name,
                source_url=link["url"],
                filename=_sanitize_filename(link["url"], source.payer_id),
                content=content,
                content_type="pdf",
                file_hash=_hash_content(content),
                fetched_at=datetime.utcnow(),
                title=link["text"],
                drug_hint=drug_hint,
            )
            docs.append(doc)
            logger.info(f"[{source.payer_id}] Downloaded {len(content)} bytes — drug hint: {drug_hint or 'unknown'}")

        except Exception as e:
            logger.warning(f"[{source.payer_id}] Failed to download {link['url']}: {e}")

    return docs


# ============================================================
# Strategy: direct_pdf
# Download PDFs from known URLs directly.
# ============================================================

def _scrape_direct_pdf(source: PayerSource) -> list[FetchedDocument]:
    """Download PDFs from direct URLs."""
    docs: list[FetchedDocument] = []

    for url in source.direct_urls:
        try:
            logger.info(f"[{source.payer_id}] Downloading direct PDF: {url}")
            resp = _fetch_url(url, timeout=120)
            content = resp.content

            # Validate it's actually a PDF
            if not _is_valid_pdf(content):
                if _is_error_page(content):
                    logger.warning(f"[{source.payer_id}] Got error page for {url}")
                    continue
                # Try to extract from wrapper (e.g. Widen CDN)
                extracted = _try_extract_pdf_from_wrapper(content, url)
                if extracted is not None:
                    content = extracted
                else:
                    logger.warning(f"[{source.payer_id}] Non-PDF content from {url}, skipping")
                    continue

            doc = FetchedDocument(
                payer_id=source.payer_id,
                payer_name=source.payer_name,
                source_url=url,
                filename=_sanitize_filename(url, source.payer_id),
                content=content,
                content_type="pdf",
                file_hash=_hash_content(content),
                fetched_at=datetime.utcnow(),
                title=f"{source.payer_name} Medical Drug Policy",
                drug_hint="",  # Comprehensive doc — covers multiple drugs
                metadata={"comprehensive": True},
            )
            docs.append(doc)
            logger.info(f"[{source.payer_id}] Downloaded {len(content)} bytes")

        except Exception as e:
            logger.warning(f"[{source.payer_id}] Failed to download {url}: {e}")

        time.sleep(REQUEST_DELAY)

    return docs


# ============================================================
# Strategy: search_portal
# Submit search queries for each target drug and fetch results.
# ============================================================

def _scrape_search_portal(source: PayerSource) -> list[FetchedDocument]:
    """Search a payer portal for each target drug and fetch results."""
    docs: list[FetchedDocument] = []

    for drug in source.target_drugs:
        try:
            # Build search URL with drug name as query parameter
            search_url = source.search_url
            if "?" in search_url:
                search_url += f"&q={drug}"
            else:
                search_url += f"?q={drug}"

            logger.info(f"[{source.payer_id}] Searching for '{drug}': {search_url}")
            resp = _fetch_url(search_url)

            # Save the search results page as HTML
            doc = FetchedDocument(
                payer_id=source.payer_id,
                payer_name=source.payer_name,
                source_url=search_url,
                filename=f"{source.payer_id}_{drug}_search_results.html",
                content=resp.content,
                content_type="html",
                file_hash=_hash_content(resp.content),
                fetched_at=datetime.utcnow(),
                title=f"{source.payer_name} — {drug} search results",
                drug_hint=drug,
            )
            docs.append(doc)

            # Look for PDF links in the results page
            soup = BeautifulSoup(resp.text, "lxml")
            for a_tag in soup.find_all("a", href=True):
                href = a_tag["href"]
                if ".pdf" in href.lower() and drug.lower() in (href + a_tag.get_text()).lower():
                    pdf_url = urljoin(search_url, href)
                    time.sleep(REQUEST_DELAY)
                    try:
                        pdf_resp = _fetch_url(pdf_url)
                        pdf_doc = FetchedDocument(
                            payer_id=source.payer_id,
                            payer_name=source.payer_name,
                            source_url=pdf_url,
                            filename=_sanitize_filename(pdf_url, source.payer_id),
                            content=pdf_resp.content,
                            content_type="pdf",
                            file_hash=_hash_content(pdf_resp.content),
                            fetched_at=datetime.utcnow(),
                            title=a_tag.get_text(strip=True),
                            drug_hint=drug,
                        )
                        docs.append(pdf_doc)
                    except Exception as e:
                        logger.warning(f"[{source.payer_id}] Failed to download linked PDF {pdf_url}: {e}")

        except Exception as e:
            logger.warning(f"[{source.payer_id}] Search failed for '{drug}': {e}")

        time.sleep(REQUEST_DELAY)

    return docs


# ============================================================
# Dispatcher
# ============================================================

STRATEGY_MAP = {
    "index_page_pdf": _scrape_index_page_pdf,
    "direct_pdf": _scrape_direct_pdf,
    "search_portal": _scrape_search_portal,
}


def scrape_source(source: PayerSource) -> list[FetchedDocument]:
    """Scrape a payer source using the configured strategy."""
    strategy_fn = STRATEGY_MAP.get(source.strategy)
    if not strategy_fn:
        logger.warning(f"[{source.payer_id}] Strategy '{source.strategy}' not implemented (manual upload?)")
        return []
    return strategy_fn(source)


def scrape_all_sources() -> dict[str, list[FetchedDocument]]:
    """Scrape all configured payer sources. Returns {payer_id: [docs]}."""
    results: dict[str, list[FetchedDocument]] = {}
    for payer_id, source in PAYER_SOURCES.items():
        if source.strategy == "manual_upload":
            logger.info(f"[{payer_id}] Skipping — manual upload only")
            continue
        try:
            docs = scrape_source(source)
            results[payer_id] = docs
            logger.info(f"[{payer_id}] Scraped {len(docs)} documents")
        except Exception as e:
            logger.error(f"[{payer_id}] Scrape failed: {e}")
            results[payer_id] = []
    return results


# ============================================================
# Store fetched documents to disk
# ============================================================

def store_fetched_docs(docs: list[FetchedDocument]) -> list[str]:
    """Save fetched documents to the storage layer. Returns file paths."""
    storage = get_storage()
    paths: list[str] = []
    for doc in docs:
        drug_dir = doc.drug_hint or "_unknown"
        path = storage.save(doc.payer_id, drug_dir, doc.filename, doc.content)
        paths.append(path)
        logger.info(f"Stored: {path} ({len(doc.content)} bytes)")
    return paths
