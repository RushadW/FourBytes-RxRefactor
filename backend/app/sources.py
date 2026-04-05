"""
Payer source configurations.

Each payer has a config describing how to find and fetch their policy documents.
Strategies:
  - "index_page_pdf": Payer has an index page listing links to individual PDF policies.
  - "direct_pdf": Direct PDF URL(s) — comprehensive doc covering multiple drugs.
  - "search_portal": Payer has a search interface — we submit queries to find policies.
  - "manual_upload": No automated scraping viable — upload PDFs manually.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PayerSource:
    payer_id: str
    payer_name: str
    strategy: str  # index_page_pdf | direct_pdf | search_portal | manual_upload
    index_url: str = ""
    base_url: str = ""
    document_type: str = "pdf"  # pdf | html
    search_url: str = ""
    direct_urls: list[str] = field(default_factory=list)
    notes: str = ""
    # Target drugs to look for (if index/search strategy)
    target_drugs: list[str] = field(default_factory=list)
    # CSS selectors / patterns for parsing the index page
    link_selector: str = ""
    link_pattern: str = ""
    headers: dict[str, str] = field(default_factory=dict)


# ============================================================
# Payer source registry
# ============================================================

PAYER_SOURCES: dict[str, PayerSource] = {
    "uhc": PayerSource(
        payer_id="uhc",
        payer_name="UnitedHealthcare",
        strategy="index_page_pdf",
        index_url="https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html",
        base_url="https://www.uhcprovider.com",
        document_type="pdf",
        link_selector="a[href$='.pdf']",
        link_pattern=r"(?i)(rituximab|rituxan|humira|adalimumab|bevacizumab|avastin|botulinum|denosumab)",
        target_drugs=["rituximab", "humira", "adalimumab", "bevacizumab", "botulinum", "denosumab"],
        notes="Index page with 250+ PDF links. Filter by drug keyword to download matching policies.",
    ),

    "cigna": PayerSource(
        payer_id="cigna",
        payer_name="Cigna",
        strategy="index_page_pdf",
        index_url="https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/pharmacy_a-z.html",
        base_url="https://static.cigna.com",
        document_type="pdf",
        link_selector="a[href$='.pdf']",
        link_pattern=r"(?i)(rituximab|humira|adalimumab|bevacizumab|avastin|botulinum|denosumab)",
        target_drugs=["rituximab", "humira", "adalimumab", "bevacizumab", "botulinum", "denosumab"],
        notes="A-Z index (pharmacy_a-z.html) with 640+ PDF links. Static HTML, no JS needed.",
    ),

    "bcbs_nc": PayerSource(
        payer_id="bcbs_nc",
        payer_name="Blue Cross Blue Shield of North Carolina",
        strategy="manual_upload",
        search_url="https://www.bluecrossnc.com/providers/prior-authorization/prescription-drugs/commercial-drug-search",
        base_url="https://www.bluecrossnc.com",
        document_type="html",
        target_drugs=["rituximab", "humira", "adalimumab", "bevacizumab"],
        notes="JS-rendered search interface. Download results in browser and upload manually.",
    ),

    "upmc": PayerSource(
        payer_id="upmc",
        payer_name="UPMC Health Plan",
        strategy="direct_pdf",
        direct_urls=[
            "https://embed.widencdn.net/download/upmc/ht2wlt3jss/RX.PA.404%20Commercial%2C%20Exchange%20Prior%20Authorization%20Policies_WEB.pdf",
        ],
        document_type="pdf",
        target_drugs=["rituximab", "humira", "adalimumab", "bevacizumab"],
        notes="Single comprehensive Prior Auth document via Widen CDN (~4MB). Covers all medical pharmacy drugs.",
    ),

    "priority_health": PayerSource(
        payer_id="priority_health",
        payer_name="Priority Health",
        strategy="direct_pdf",
        direct_urls=[
            "https://fm.formularynavigator.com/FBO/208/MDL_EmployerGroupMyPriority_2026.pdf",
        ],
        document_type="pdf",
        target_drugs=["rituximab", "humira", "adalimumab", "bevacizumab"],
        notes="Single medical drug list PDF (~3MB). Formulary Navigator hosted.",
    ),

    "emblemhealth": PayerSource(
        payer_id="emblemhealth",
        payer_name="EmblemHealth",
        strategy="manual_upload",
        index_url="https://gatewaypa.com/emblemhealth/policydisplay/55",
        document_type="pdf",
        target_drugs=["rituximab", "humira", "denosumab"],
        notes="GatewayPA JS app — requires browser. Save page or download PDF manually.",
    ),

    "florida_blue": PayerSource(
        payer_id="florida_blue",
        payer_name="Florida Blue",
        strategy="manual_upload",
        index_url="https://mcgs.bcbsfl.com/",
        document_type="html",
        target_drugs=["rituximab", "bevacizumab"],
        notes="MCG third-party JS portal. Search by drug, save results, upload manually.",
    ),
}


def get_source(payer_id: str) -> PayerSource | None:
    return PAYER_SOURCES.get(payer_id)


def list_sources() -> list[PayerSource]:
    return list(PAYER_SOURCES.values())


def get_scrapable_sources() -> list[PayerSource]:
    return [s for s in PAYER_SOURCES.values() if s.strategy != "manual_upload"]
