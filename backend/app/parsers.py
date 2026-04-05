"""PDF and HTML parsers for policy documents, with Claude-powered extraction."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


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


# ---------- Claude-powered structured extraction ----------

_EXTRACTION_PROMPT = """You are a medical policy document analyst. Extract structured fields from this payer drug policy document.

Return ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "drug_name": "Brand name of the drug (e.g. Rituxan, Humira)",
  "generic_name": "Generic/scientific name (e.g. rituximab, adalimumab)",
  "drug_category": "Drug class (e.g. Anti-CD20 Monoclonal Antibody, TNF Inhibitor)",
  "therapeutic_area": "Disease area (e.g. Oncology, Rheumatology, Autoimmune)",
  "policy_title": "Title of the policy document",
  "covered": true,
  "access_status": "preferred | non-preferred | specialty | restricted | formulary",
  "preferred_count": 0,
  "covered_indications": ["List of approved indications/diagnoses"],
  "prior_auth": false,
  "prior_auth_details": "Detailed prior authorization criteria and requirements",
  "step_therapy": false,
  "step_therapy_details": "Step therapy requirements — which drugs must be tried first",
  "site_of_care": ["List: Hospital Outpatient, Infusion Center, Home Infusion, Physician Office, Self-Administration"],
  "dosing_limits": "Dosing/quantity limits, frequency restrictions",
  "coverage_criteria": ["List of clinical criteria required for coverage"],
  "effective_date": "Policy effective date if found (e.g. 01/01/2026)",
  "confidence": "high | medium | low"
}

RULES:
- Extract ONLY information explicitly stated in the document. Do not invent data.
- If a field is not found in the document, use null for strings, false for booleans, [] for arrays, 0 for numbers.
- For covered_indications, list each approved diagnosis/condition as a separate item.
- For coverage_criteria, list each clinical requirement as a separate item.
- For prior_auth_details and step_therapy_details, include specific criteria, diagnosis codes, and requirements.
- Set confidence to "high" if the document clearly covers the drug, "medium" if partially, "low" if uncertain.
- Return ONLY the JSON object, nothing else."""


def claude_extract_fields(
    text: str,
    drug_hint: str = "",
    payer_hint: str = "",
) -> dict | None:
    """Use Claude to extract structured policy fields from raw document text.

    Returns a dict of extracted fields, or None if Claude is unavailable.
    """
    from app.config import settings

    if not settings.anthropic_api_key:
        logger.info("No Anthropic API key — skipping Claude extraction")
        return None

    # Truncate to ~12k chars to stay well within context window while being cost-effective
    max_chars = 12_000
    if len(text) > max_chars:
        # Take beginning (usually has drug name, policy title) + end (often has effective dates)
        text = text[:9_000] + "\n\n[...middle of document truncated...]\n\n" + text[-3_000:]

    context_hint = ""
    if drug_hint:
        context_hint += f"\nThis document is likely about the drug: {drug_hint}"
    if payer_hint:
        context_hint += f"\nThis document is from payer: {payer_hint}"

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"{_EXTRACTION_PROMPT}"
                        f"{context_hint}\n\n"
                        f"--- POLICY DOCUMENT TEXT ---\n{text}\n--- END ---"
                    ),
                }
            ],
        )

        raw = message.content[0].text.strip()

        # Strip markdown code fences if Claude included them
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

        data = json.loads(raw)
        logger.info(f"Claude extraction successful — drug: {data.get('drug_name')}, confidence: {data.get('confidence')}")
        return data

    except json.JSONDecodeError as e:
        logger.warning(f"Claude returned invalid JSON: {e}")
        return None
    except Exception as e:
        logger.warning(f"Claude extraction failed: {e}")
        return None


def extract_fields_with_claude(
    parsed: ParsedDocument,
    drug_hint: str = "",
    payer_hint: str = "",
) -> dict:
    """Extract fields using Claude (preferred) with regex fallback.

    Always returns a dict with at least the basic fields.
    """
    # Try Claude first
    claude_result = claude_extract_fields(parsed.full_text, drug_hint, payer_hint)
    if claude_result:
        # Normalize types
        result = {}
        result["drug_name"] = claude_result.get("drug_name") or ""
        result["generic_name"] = claude_result.get("generic_name") or ""
        result["drug_category"] = claude_result.get("drug_category") or ""
        result["therapeutic_area"] = claude_result.get("therapeutic_area") or ""
        result["policy_title"] = claude_result.get("policy_title") or parsed.title or ""
        result["covered"] = bool(claude_result.get("covered", True))
        result["access_status"] = claude_result.get("access_status") or ""
        result["preferred_count"] = int(claude_result.get("preferred_count") or 0)
        result["covered_indications"] = claude_result.get("covered_indications") or []
        result["prior_auth"] = bool(claude_result.get("prior_auth", False))
        result["prior_auth_details"] = claude_result.get("prior_auth_details") or ""
        result["step_therapy"] = bool(claude_result.get("step_therapy", False))
        result["step_therapy_details"] = claude_result.get("step_therapy_details") or ""
        result["site_of_care"] = claude_result.get("site_of_care") or []
        result["dosing_limits"] = claude_result.get("dosing_limits") or ""
        result["coverage_criteria"] = claude_result.get("coverage_criteria") or []
        result["effective_date"] = claude_result.get("effective_date") or ""
        result["confidence"] = claude_result.get("confidence") or "medium"
        # Filter out null/None from lists
        result["covered_indications"] = [x for x in result["covered_indications"] if x]
        result["coverage_criteria"] = [x for x in result["coverage_criteria"] if x]
        result["site_of_care"] = [x for x in result["site_of_care"] if x]
        return result

    # Fallback to regex
    logger.info("Falling back to regex extraction")
    basic = extract_fields(parsed)
    basic["policy_title"] = parsed.title or ""
    basic["confidence"] = "low"
    return basic
