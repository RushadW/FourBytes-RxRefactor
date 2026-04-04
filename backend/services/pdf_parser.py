import pdfplumber
from pathlib import Path
from typing import List, Dict, Any


CHUNK_SIZE = 3200   # ~800 tokens
CHUNK_OVERLAP = 400  # ~100 tokens


def extract_text_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """Returns list of {page_num, text} dicts."""
    pages = []
    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages.append({"page_num": i + 1, "text": text})
    return pages


def extract_text_from_txt(file_path: str) -> List[Dict[str, Any]]:
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()
    # Simulate single-page for text files
    return [{"page_num": 1, "text": text}]


def extract_text(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)
    if path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(file_path)
    elif path.suffix.lower() in (".txt", ".md"):
        return extract_text_from_txt(file_path)
    else:
        # Attempt PDF as fallback
        try:
            return extract_text_from_pdf(file_path)
        except Exception:
            return extract_text_from_txt(file_path)


def get_full_text(pages: List[Dict[str, Any]]) -> str:
    return "\n\n".join(p["text"] for p in pages if p["text"].strip())


def chunk_pages(pages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Split document text into overlapping chunks with page-number tracking."""
    # Flatten to (char, page_num) pairs
    char_page = []
    for page in pages:
        text = page["text"]
        for ch in text:
            char_page.append((ch, page["page_num"]))
        char_page.append(("\n", page["page_num"]))

    full_text = "".join(c for c, _ in char_page)
    chunks = []
    start = 0
    idx = 0

    while start < len(full_text):
        end = min(start + CHUNK_SIZE, len(full_text))
        chunk_text = full_text[start:end]

        # Determine most common page_num in this chunk
        page_nums = [char_page[i][1] for i in range(start, end) if i < len(char_page)]
        page_num = max(set(page_nums), key=page_nums.count) if page_nums else 1

        chunks.append({
            "chunk_index": idx,
            "text": chunk_text.strip(),
            "page_num": page_num,
        })
        idx += 1
        start += CHUNK_SIZE - CHUNK_OVERLAP

    return [c for c in chunks if c["text"]]


def batch_text_for_extraction(full_text: str, batch_size: int = 60000) -> List[str]:
    """Split full document text into batches for Claude extraction."""
    batches = []
    start = 0
    while start < len(full_text):
        batches.append(full_text[start:start + batch_size])
        start += batch_size
    return batches
