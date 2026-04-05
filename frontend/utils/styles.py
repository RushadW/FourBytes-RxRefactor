"""
RxRefactor — Streamlit CSS injection.
Ports the mockup design system into Streamlit.
Rules are surgical — no broad wildcards that bleed into components.
"""

import streamlit as st


def inject():
    st.markdown("""
<style>
/* ════════════════════════════════════════════════════════
   RESET / BASE
═══════════════════════════════════════════════════════ */

/* App background */
.stApp {
    background-color: #f1f5f9 !important;
}

/* Main content block padding */
.block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 2rem !important;
    max-width: 1400px !important;
}

/* Ensure main content text is always dark */
.stApp .block-container p,
.stApp .block-container span,
.stApp .block-container div,
.stApp .block-container li,
.stApp .block-container td,
.stApp .block-container th {
    color: inherit;
}

/* ════════════════════════════════════════════════════════
   SIDEBAR — dark blue background, white text ONLY on
   elements we know are text (not inputs/dropdowns)
═══════════════════════════════════════════════════════ */

/* Sidebar container */
section[data-testid="stSidebar"] {
    background-color: #1e3a5f !important;
}
section[data-testid="stSidebar"] > div:first-child {
    background-color: #1e3a5f !important;
}

/* Sidebar headings */
section[data-testid="stSidebar"] h1,
section[data-testid="stSidebar"] h2,
section[data-testid="stSidebar"] h3 {
    color: #ffffff !important;
    font-size: 18px !important;
    font-weight: 700 !important;
}

/* Sidebar paragraph text and captions */
section[data-testid="stSidebar"] p {
    color: rgba(255, 255, 255, 0.65) !important;
    font-size: 12px !important;
}

/* Sidebar markdown text */
section[data-testid="stSidebar"] .stMarkdown p {
    color: rgba(255, 255, 255, 0.65) !important;
}

/* Sidebar caption */
section[data-testid="stSidebar"] [data-testid="stCaptionContainer"] p {
    color: rgba(255, 255, 255, 0.55) !important;
}

/* Sidebar divider */
section[data-testid="stSidebar"] hr {
    border-color: rgba(255, 255, 255, 0.15) !important;
}

/* Sidebar multiselect — label */
section[data-testid="stSidebar"] label {
    color: rgba(255, 255, 255, 0.65) !important;
    font-size: 12px !important;
}

/* Sidebar multiselect — the pill box */
section[data-testid="stSidebar"] [data-baseweb="select"] > div {
    background-color: rgba(255, 255, 255, 0.1) !important;
    border-color: rgba(255, 255, 255, 0.25) !important;
}
/* Sidebar multiselect — placeholder text */
section[data-testid="stSidebar"] [data-baseweb="select"] [data-testid="stMarkdownContainer"] p,
section[data-testid="stSidebar"] [data-baseweb="select"] input {
    color: rgba(255, 255, 255, 0.8) !important;
}
/* Sidebar multiselect — tag pills */
section[data-testid="stSidebar"] [data-baseweb="tag"] {
    background-color: rgba(37, 99, 235, 0.5) !important;
    color: #ffffff !important;
}
section[data-testid="stSidebar"] [data-baseweb="tag"] span {
    color: #ffffff !important;
}

/* Sidebar warning */
section[data-testid="stSidebar"] [data-testid="stAlert"] {
    background-color: rgba(251, 191, 36, 0.15) !important;
    border-color: rgba(251, 191, 36, 0.3) !important;
    color: #fef3c7 !important;
}
section[data-testid="stSidebar"] [data-testid="stAlert"] p {
    color: #fef3c7 !important;
}

/* Sidebar links */
section[data-testid="stSidebar"] a {
    color: rgba(255, 255, 255, 0.55) !important;
    text-decoration: none !important;
}
section[data-testid="stSidebar"] a:hover {
    color: #ffffff !important;
}

/* ════════════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════════ */

[data-testid="stTabs"] [data-baseweb="tab-list"] {
    background-color: #ffffff !important;
    border-bottom: 2px solid #e2e8f0 !important;
    gap: 0 !important;
    padding: 0 4px !important;
}

[data-testid="stTabs"] [data-baseweb="tab"] {
    background: transparent !important;
    color: #64748b !important;
    font-size: 13.5px !important;
    font-weight: 500 !important;
    padding: 10px 18px !important;
    border-bottom: 2px solid transparent !important;
    border-radius: 0 !important;
    margin-bottom: -2px !important;
}

[data-testid="stTabs"] [data-baseweb="tab"]:hover {
    color: #1d4ed8 !important;
    background-color: #eff6ff !important;
}

[data-testid="stTabs"] [aria-selected="true"] {
    color: #1d4ed8 !important;
    font-weight: 600 !important;
    border-bottom: 2px solid #2563eb !important;
    background: transparent !important;
}

/* Hide the animated underline bar (we draw our own) */
[data-testid="stTabs"] [data-baseweb="tab-highlight"] {
    display: none !important;
}

/* Tab content area */
[data-testid="stTabs"] [data-baseweb="tab-panel"] {
    padding-top: 1.25rem !important;
    background: transparent !important;
}

/* ════════════════════════════════════════════════════════
   HEADINGS (main content only)
═══════════════════════════════════════════════════════ */

.block-container h1 {
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
    letter-spacing: -0.3px !important;
    margin-bottom: 4px !important;
}
.block-container h2 {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #0f172a !important;
    margin-top: 1.25rem !important;
}
.block-container h3 {
    font-size: 14px !important;
    font-weight: 600 !important;
    color: #0f172a !important;
}

/* Caption */
.block-container [data-testid="stCaptionContainer"] p {
    color: #64748b !important;
    font-size: 12.5px !important;
}

/* ════════════════════════════════════════════════════════
   BUTTONS
═══════════════════════════════════════════════════════ */

.stButton > button {
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    padding: 7px 18px !important;
    border: none !important;
    box-shadow: none !important;
    transition: opacity 0.15s !important;
}

/* Primary */
.stButton > button[kind="primary"] {
    background-color: #2563eb !important;
    color: #ffffff !important;
}
.stButton > button[kind="primary"]:hover {
    background-color: #1d4ed8 !important;
    color: #ffffff !important;
}

/* Secondary */
.stButton > button[kind="secondary"] {
    background-color: #e2e8f0 !important;
    color: #334155 !important;
}
.stButton > button[kind="secondary"]:hover {
    background-color: #cbd5e1 !important;
    color: #0f172a !important;
}

/* ════════════════════════════════════════════════════════
   INPUTS
═══════════════════════════════════════════════════════ */

.stTextInput input,
.stNumberInput input {
    border: 1.5px solid #cbd5e1 !important;
    border-radius: 6px !important;
    font-size: 13.5px !important;
    color: #0f172a !important;
    background-color: #ffffff !important;
}

.stTextInput input:focus,
.stNumberInput input:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
    color: #0f172a !important;
}

.stTextArea textarea {
    border: 1.5px solid #cbd5e1 !important;
    border-radius: 6px !important;
    font-size: 13.5px !important;
    color: #0f172a !important;
    background-color: #ffffff !important;
}

.stTextArea textarea:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12) !important;
}

/* Input labels in main content */
.block-container label {
    font-size: 13px !important;
    font-weight: 500 !important;
    color: #334155 !important;
}

/* ════════════════════════════════════════════════════════
   SELECTBOX / MULTISELECT (main content)
═══════════════════════════════════════════════════════ */

.block-container [data-baseweb="select"] > div {
    border: 1.5px solid #cbd5e1 !important;
    border-radius: 6px !important;
    background-color: #ffffff !important;
}

.block-container [data-baseweb="select"] [data-testid="stMarkdownContainer"] p {
    color: #334155 !important;
    font-size: 13.5px !important;
}

/* Multiselect tag pills in main content */
.block-container [data-baseweb="tag"] {
    background-color: #dbeafe !important;
    color: #1d4ed8 !important;
    border-radius: 20px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
}

.block-container [data-baseweb="tag"] span {
    color: #1d4ed8 !important;
}

/* ════════════════════════════════════════════════════════
   METRICS
═══════════════════════════════════════════════════════ */

[data-testid="metric-container"] {
    background-color: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    padding: 16px 18px !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
}

[data-testid="metric-container"] [data-testid="stMetricLabel"] p {
    font-size: 11.5px !important;
    font-weight: 500 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.04em !important;
    color: #64748b !important;
}

[data-testid="metric-container"] [data-testid="stMetricValue"] {
    font-size: 26px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
}

/* ════════════════════════════════════════════════════════
   DATAFRAME
═══════════════════════════════════════════════════════ */

[data-testid="stDataFrame"] {
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
}

/* ════════════════════════════════════════════════════════
   ALERTS
═══════════════════════════════════════════════════════ */

[data-testid="stAlert"][data-type="info"] {
    background-color: #eff6ff !important;
    border-left-color: #2563eb !important;
}
[data-testid="stAlert"][data-type="info"] p {
    color: #1d4ed8 !important;
}

[data-testid="stAlert"][data-type="success"] {
    background-color: #dcfce7 !important;
    border-left-color: #15803d !important;
}
[data-testid="stAlert"][data-type="success"] p {
    color: #15803d !important;
}

[data-testid="stAlert"][data-type="warning"] {
    background-color: #fef3c7 !important;
    border-left-color: #b45309 !important;
}
[data-testid="stAlert"][data-type="warning"] p {
    color: #b45309 !important;
}

[data-testid="stAlert"][data-type="error"] {
    background-color: #fee2e2 !important;
    border-left-color: #b91c1c !important;
}
[data-testid="stAlert"][data-type="error"] p {
    color: #b91c1c !important;
}

/* ════════════════════════════════════════════════════════
   EXPANDER
═══════════════════════════════════════════════════════ */

[data-testid="stExpander"] {
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    background-color: #ffffff !important;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06) !important;
}

[data-testid="stExpander"] summary {
    font-weight: 600 !important;
    font-size: 13px !important;
    color: #0f172a !important;
}

[data-testid="stExpander"] summary p {
    color: #0f172a !important;
    font-weight: 600 !important;
}

/* ════════════════════════════════════════════════════════
   CONTAINERS (border=True)
═══════════════════════════════════════════════════════ */

[data-testid="stVerticalBlockBorderWrapper"] {
    border: 1px solid #e2e8f0 !important;
    border-radius: 8px !important;
    background-color: #ffffff !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06) !important;
    padding: 14px 18px !important;
}

/* Text inside bordered containers */
[data-testid="stVerticalBlockBorderWrapper"] p {
    color: #334155 !important;
}
[data-testid="stVerticalBlockBorderWrapper"] strong {
    color: #0f172a !important;
}

/* ════════════════════════════════════════════════════════
   FILE UPLOADER
═══════════════════════════════════════════════════════ */

[data-testid="stFileUploader"] {
    border: 2px dashed #cbd5e1 !important;
    border-radius: 8px !important;
    background-color: #f8fafc !important;
    padding: 16px !important;
}

[data-testid="stFileUploader"] p,
[data-testid="stFileUploader"] span {
    color: #64748b !important;
}

/* ════════════════════════════════════════════════════════
   RADIO
═══════════════════════════════════════════════════════ */

.block-container [data-testid="stRadio"] label p {
    color: #334155 !important;
    font-size: 13px !important;
}

/* ════════════════════════════════════════════════════════
   CHECKBOX
═══════════════════════════════════════════════════════ */

.block-container [data-testid="stCheckbox"] label p {
    color: #334155 !important;
    font-size: 13px !important;
}

/* ════════════════════════════════════════════════════════
   SLIDER
═══════════════════════════════════════════════════════ */

.block-container [data-testid="stSlider"] p {
    color: #334155 !important;
}

/* ════════════════════════════════════════════════════════
   DOWNLOAD BUTTON
═══════════════════════════════════════════════════════ */

[data-testid="stDownloadButton"] > button {
    background-color: #f1f5f9 !important;
    color: #334155 !important;
    border: 1px solid #e2e8f0 !important;
    font-size: 12.5px !important;
    border-radius: 6px !important;
}
[data-testid="stDownloadButton"] > button:hover {
    background-color: #e2e8f0 !important;
    color: #0f172a !important;
}

/* ════════════════════════════════════════════════════════
   DIVIDER
═══════════════════════════════════════════════════════ */

.block-container hr {
    border-color: #e2e8f0 !important;
}

/* ════════════════════════════════════════════════════════
   SCROLLBAR
═══════════════════════════════════════════════════════ */

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }

/* ════════════════════════════════════════════════════════
   SPINNER
═══════════════════════════════════════════════════════ */

[data-testid="stSpinner"] p {
    color: #64748b !important;
}
</style>
""", unsafe_allow_html=True)


# ── Reusable HTML badge components ───────────────────────────────────────────

def badge(text: str, color: str = "slate") -> str:
    palette = {
        "green":  ("#dcfce7", "#15803d"),
        "amber":  ("#fef3c7", "#b45309"),
        "red":    ("#fee2e2", "#b91c1c"),
        "blue":   ("#dbeafe", "#1d4ed8"),
        "purple": ("#ede9fe", "#7c3aed"),
        "slate":  ("#e2e8f0", "#334155"),
    }
    bg, fg = palette.get(color, palette["slate"])
    return (
        f'<span style="display:inline-flex;align-items:center;padding:3px 9px;'
        f'border-radius:20px;font-size:11.5px;font-weight:600;'
        f'background:{bg};color:{fg};">{text}</span>'
    )


def coverage_badge(status: str) -> str:
    mapping = {
        "covered":                   ("Covered",     "green"),
        "covered_with_restrictions": ("Restricted",  "amber"),
        "not_covered":               ("Not Covered", "red"),
        "non_formulary":             ("Non-Form.",   "red"),
        "partial":                   ("Partial",     "amber"),
    }
    text, color = mapping.get(status or "", (status or "Unknown", "slate"))
    return badge(text, color)


def benefit_badge(side: str) -> str:
    mapping = {
        "medical":  ("Medical",  "purple"),
        "pharmacy": ("Pharmacy", "blue"),
        "both":     ("Both",     "green"),
    }
    text, color = mapping.get(side or "", ("Unknown", "slate"))
    return badge(text, color)


def dc_badge(dc: str) -> str:
    mapping = {
        "high":   ("🟢 High",   "green"),
        "medium": ("🟡 Medium", "amber"),
        "low":    ("🔴 Low",    "red"),
    }
    text, color = mapping.get(dc or "", ("🔴 Low", "red"))
    return badge(text, color)


def tier_badge(tier: str, cost: str = "", cache_hit: bool = False) -> str:
    labels = {
        "tier_1_structured": ("🗃 Tier 1 · No LLM",      "green"),
        "tier_2_synthesis":  ("⚡ Tier 2 · Synthesis",    "blue"),
        "tier_3_rag":        ("🔍 Tier 3 · Full RAG",     "slate"),
    }
    text, color = labels.get(tier or "", (tier or "Unknown", "slate"))
    if cost:
        text += f" · {cost}"
    if cache_hit:
        text += " · ⚡ Cache"
    return badge(text, color)


def card_html(title: str, body_html: str, badge_html: str = "") -> str:
    right = f'<span>{badge_html}</span>' if badge_html else ""
    return f"""
<div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;
            box-shadow:0 1px 3px rgba(0,0,0,0.08);margin-bottom:16px;overflow:hidden;">
  <div style="padding:13px 18px;border-bottom:1px solid #e2e8f0;
              display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:14px;font-weight:600;color:#0f172a;">{title}</span>
    {right}
  </div>
  <div style="padding:16px 18px;color:#334155;">{body_html}</div>
</div>"""
