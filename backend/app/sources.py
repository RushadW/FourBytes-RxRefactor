"""
Payer source configurations.

Each payer has a config describing how to find and fetch their policy documents.
Strategies:
  - "index_page_pdf": Payer has an index page listing links to individual PDF policies.
  - "direct_pdf": Direct PDF URL(s) — comprehensive doc covering multiple drugs.
  - "search_portal": Payer has a search interface — we submit queries to find policies.
  - "web_page_content": Payer publishes policy text as HTML pages (e.g. Aetna CPBs).
  - "manual_upload": No automated scraping viable — upload PDFs manually.
"""
from __future__ import annotations

from dataclasses import dataclass, field


# All target drugs we track across payers
TARGET_DRUGS = [
    "rituximab", "adalimumab", "humira", "bevacizumab", "avastin",
    "botulinum", "botox", "denosumab", "prolia", "xgeva",
    "infliximab", "remicade", "trastuzumab", "herceptin",
    "pembrolizumab", "keytruda", "nivolumab", "opdivo",
    "ocrelizumab", "ocrevus", "natalizumab", "tysabri",
    "ustekinumab", "stelara", "vedolizumab", "entyvio",
    "dupilumab", "dupixent", "secukinumab", "cosentyx",
]


@dataclass
class PayerSource:
    payer_id: str
    payer_name: str
    strategy: str  # index_page_pdf | direct_pdf | search_portal | web_page_content | manual_upload
    index_url: str = ""
    base_url: str = ""
    document_type: str = "pdf"  # pdf | html
    search_url: str = ""
    direct_urls: list[str] = field(default_factory=list)
    # For web_page_content strategy: map drug_hint -> URL
    page_urls: dict[str, str] = field(default_factory=dict)
    notes: str = ""
    # Target drugs to look for (if index/search strategy)
    target_drugs: list[str] = field(default_factory=list)
    # CSS selectors / patterns for parsing the index page
    link_selector: str = ""
    link_pattern: str = ""
    # CSS selector to extract main content from HTML policy pages
    content_selector: str = ""
    headers: dict[str, str] = field(default_factory=dict)


# ============================================================
# Payer source registry
# ============================================================

PAYER_SOURCES: dict[str, PayerSource] = {

    # ------------------------------------------------------------------
    # Cigna — A-Z drug policy index with individual PDF downloads
    # Static HTML page with 642 PDF links. No JS needed.
    # Verified working: 15 drug-specific PDFs for our target drugs.
    # ------------------------------------------------------------------
    "cigna": PayerSource(
        payer_id="cigna",
        payer_name="Cigna",
        strategy="index_page_pdf",
        index_url="https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/pharmacy_a-z.html",
        base_url="https://static.cigna.com",
        document_type="pdf",
        link_selector="a[href$='.pdf']",
        link_pattern=(
            r"(?i)(rituximab|adalimumab|humira|bevacizumab|avastin|"
            r"botulinum|botox|denosumab|prolia|xgeva|infliximab|remicade|"
            r"trastuzumab|herceptin|pembrolizumab|keytruda|nivolumab|opdivo|"
            r"ocrelizumab|ocrevus|natalizumab|tysabri|ustekinumab|stelara|"
            r"vedolizumab|entyvio|dupilumab|dupixent|secukinumab|cosentyx)"
        ),
        target_drugs=TARGET_DRUGS,
        notes="A-Z index with 642 PDF links. Static HTML. "
              "Key policies: IP0319 (Rituximab), IP0331/IP0332 (Denosumab), "
              "IP0637 (Botox), Adalimumab (multiple), Infliximab (multiple).",
    ),

    # ------------------------------------------------------------------
    # UnitedHealthcare — Commercial medical drug policies page
    # Has 259 PDF links. Drug-specific PDFs found for: Botulinum, Denosumab,
    # Infliximab, Rituximab. Other drugs may be covered in update bulletins.
    # ------------------------------------------------------------------
    "uhc": PayerSource(
        payer_id="uhc",
        payer_name="UnitedHealthcare",
        strategy="index_page_pdf",
        index_url="https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html",
        base_url="https://www.uhcprovider.com",
        document_type="pdf",
        link_selector="a[href$='.pdf']",
        link_pattern=(
            r"(?i)(rituximab|rituxan|adalimumab|humira|bevacizumab|avastin|"
            r"botulinum|botox|denosumab|prolia|xgeva|infliximab|remicade|"
            r"trastuzumab|herceptin|pembrolizumab|keytruda|nivolumab|opdivo|"
            r"ocrelizumab|ocrevus|natalizumab|tysabri|ustekinumab|stelara|"
            r"vedolizumab|entyvio|dupilumab|dupixent|secukinumab|cosentyx)"
        ),
        target_drugs=TARGET_DRUGS,
        notes="259 PDF links on the page. Drug-specific PDFs confirmed for "
              "Botulinum, Denosumab, Infliximab, Rituximab.",
    ),

    # ------------------------------------------------------------------
    # UPMC Health Plan — comprehensive Prior Auth document
    # Widen CDN: the /pdf/plus/ URL returns HTML wrapper, but
    # /download/ URL gives the actual 4MB PDF.
    # ------------------------------------------------------------------
    "upmc": PayerSource(
        payer_id="upmc",
        payer_name="UPMC Health Plan",
        strategy="direct_pdf",
        direct_urls=[
            "https://embed.widencdn.net/download/upmc/ht2wlt3jss/RX.PA.404%20Commercial%2C%20Exchange%20Prior%20Authorization%20Policies_WEB.pdf",
        ],
        document_type="pdf",
        target_drugs=TARGET_DRUGS,
        notes="Single comprehensive Prior Auth document via Widen CDN (~4MB). "
              "Use the /download/ URL (not /pdf/plus/). Covers all medical pharmacy drugs.",
    ),

    # ------------------------------------------------------------------
    # Priority Health — formulary drug list PDF
    # Direct PDF download, ~3MB. Formulary Navigator hosted.
    # ------------------------------------------------------------------
    "priority_health": PayerSource(
        payer_id="priority_health",
        payer_name="Priority Health",
        strategy="direct_pdf",
        direct_urls=[
            "https://fm.formularynavigator.com/FBO/208/MDL_EmployerGroupMyPriority_2026.pdf",
        ],
        document_type="pdf",
        target_drugs=TARGET_DRUGS,
        notes="Single medical drug list PDF (~3MB). Formulary Navigator hosted.",
    ),

    # ------------------------------------------------------------------
    # EmblemHealth — Gateway PA Portal (React SPA, JS-rendered)
    # The URL https://gatewaypa.com/emblemhealth/policydisplay/55 is a
    # JS SPA that requires browser rendering. Cannot scrape with httpx.
    # ------------------------------------------------------------------
    "emblemhealth": PayerSource(
        payer_id="emblemhealth",
        payer_name="EmblemHealth",
        strategy="manual_upload",
        base_url="https://gatewaypa.com",
        page_urls={
            "all": "https://gatewaypa.com/emblemhealth/policydisplay/55",
        },
        document_type="html",
        target_drugs=TARGET_DRUGS,
        notes="React SPA behind JS rendering — cannot scrape with httpx. "
              "Open in browser, print/save page as PDF, then upload manually.",
    ),

    # ------------------------------------------------------------------
    # Blue Cross Blue Shield of North Carolina — JS-rendered drug search
    # The search interface is fully JS-rendered (Adobe AEM).
    # Cannot automate without headless browser.
    # ------------------------------------------------------------------
    "bcbs_nc": PayerSource(
        payer_id="bcbs_nc",
        payer_name="Blue Cross Blue Shield of North Carolina",
        strategy="manual_upload",
        search_url="https://www.bluecrossnc.com/providers/prior-authorization/prescription-drugs/commercial-drug-search",
        base_url="https://www.bluecrossnc.com",
        document_type="html",
        target_drugs=TARGET_DRUGS,
        notes="JS-rendered search interface (Adobe AEM). "
              "Search each drug in browser, save results as PDF, upload manually.",
    ),

    # ------------------------------------------------------------------
    # Florida Blue — MCG Medical Coverage Guidelines
    # ASP.NET WebForms with Telerik RadAjax panels. Search POST works
    # (finds 'Rituximab Products') but results are dynamically rendered
    # via AJAX — links point to '#'. Cannot extract content without JS.
    # ------------------------------------------------------------------
    "florida_blue": PayerSource(
        payer_id="florida_blue",
        payer_name="Florida Blue",
        strategy="manual_upload",
        search_url="https://mcgs.bcbsfl.com/",
        base_url="https://mcgs.bcbsfl.com",
        document_type="html",
        target_drugs=TARGET_DRUGS,
        notes="ASP.NET WebForms with Telerik AJAX panels. "
              "Search works server-side but results render via JS postback. "
              "Open in browser, search each drug, save/print results, upload manually.",
    ),
}


def get_source(payer_id: str) -> PayerSource | None:
    return PAYER_SOURCES.get(payer_id)


def list_sources() -> list[PayerSource]:
    return list(PAYER_SOURCES.values())


def get_scrapable_sources() -> list[PayerSource]:
    return [s for s in PAYER_SOURCES.values() if s.strategy != "manual_upload"]
