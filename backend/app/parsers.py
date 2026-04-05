"""PDF and HTML parsers for policy documents."""
from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ParsedSection:
    heading: str
    text: str


@dataclass
class ParsedDocument:
    title: str = ""
    payer: str = ""
    drug: str = ""
    full_text: str = ""
    sections: list[ParsedSection] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


# ---------- PDF parsing (PyMuPDF) ----------

def parse_pdf(file_path: str) -> ParsedDocument:
    import fitz  # PyMuPDF

    doc = fitz.open(file_path)
    pages_text: list[str] = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n".join(pages_text)
    sections = _split_sections(full_text)
    title = _extract_title(full_text)

    return ParsedDocument(
        title=title,
        full_text=full_text,
        sections=sections,
        metadata={"pages": len(pages_text), "source": file_path},
    )


def parse_pdf_bytes(content: bytes) -> ParsedDocument:
    import fitz

    doc = fitz.open(stream=content, filetype="pdf")
    pages_text: list[str] = []
    for page in doc:
        pages_text.append(page.get_text())
    doc.close()

    full_text = "\n".join(pages_text)
    sections = _split_sections(full_text)
    title = _extract_title(full_text)

    return ParsedDocument(
        title=title,
        full_text=full_text,
        sections=sections,
    )


# ---------- HTML parsing ----------

def parse_html(content: str) -> ParsedDocument:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(content, "lxml")

    # Remove scripts, styles
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    title = soup.title.string if soup.title else ""
    full_text = soup.get_text(separator="\n", strip=True)
    sections = _split_sections(full_text)

    return ParsedDocument(
        title=title or "",
        full_text=full_text,
        sections=sections,
    )


# ---------- Section splitting ----------

_SECTION_PATTERN = re.compile(
    r"^(?:#{1,3}\s+)?"
    r"(DESCRIPTION|COVERAGE CRITERIA|PRIOR AUTHORIZATION|STEP THERAPY|"
    r"SITE OF CARE|DOSING|QUANTITY LIMITS|INDICATIONS|EFFECTIVE DATE|"
    r"POLICY NUMBER|DRUG CATEGORY|ACCESS STATUS|REFERENCES|"
    r"BACKGROUND|CLINICAL CRITERIA|APPROVAL DURATION|"
    r"AUTHORIZATION REQUIREMENTS|PLACE OF SERVICE|"
    r"MEDICAL NECESSITY|LIMITATIONS|EXCLUSIONS)",
    re.IGNORECASE | re.MULTILINE,
)


def _split_sections(text: str) -> list[ParsedSection]:
    matches = list(_SECTION_PATTERN.finditer(text))
    if not matches:
        return [ParsedSection(heading="Full Document", text=text.strip())]

    sections: list[ParsedSection] = []
    for i, m in enumerate(matches):
        heading = m.group(1).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if body:
            sections.append(ParsedSection(heading=heading, text=body))
    return sections


def _extract_title(text: str) -> str:
    for line in text.split("\n"):
        line = line.strip()
        if len(line) > 10 and any(kw in line.upper() for kw in ["POLICY", "COVERAGE", "MEDICAL"]):
            return line[:200]
    return ""


# ---------- Field extraction helpers ----------

def extract_fields(parsed: ParsedDocument) -> dict:
    """Best-effort extraction of structured fields from parsed text."""
    text = parsed.full_text.upper()
    fields: dict = {}

    # Prior auth
    fields["prior_auth"] = any(
        kw in text for kw in ["PRIOR AUTHORIZATION REQUIRED", "PRIOR AUTH IS REQUIRED", "PRECERTIFICATION REQUIRED"]
    )

    # Step therapy
    fields["step_therapy"] = any(
        kw in text for kw in ["STEP THERAPY", "STEP EDIT", "FAIL-FIRST", "MUST TRY", "MUST HAVE TRIED"]
    )

    # Site of care
    sites: list[str] = []
    if "HOSPITAL OUTPATIENT" in text:
        sites.append("Hospital Outpatient")
    if "INFUSION CENTER" in text:
        sites.append("Infusion Center")
    if "HOME INFUSION" in text or "HOME HEALTH" in text:
        sites.append("Home Infusion")
    if "SELF-ADMINISTRATION" in text or "SELF-ADMIN" in text:
        sites.append("Self-Administration")
    if "PHYSICIAN OFFICE" in text:
        sites.append("Physician Office")
    fields["site_of_care"] = sites

    return fields
