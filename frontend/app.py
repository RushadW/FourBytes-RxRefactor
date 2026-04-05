"""
AntonRx — Streamlit frontend entry point.
Tab logic lives in frontend/tabs/*.py for easy editing.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from frontend.utils import api_client
from frontend.utils.styles import inject as inject_styles
from frontend.tabs import upload, ask, coverage, compare, changes, mlops

st.set_page_config(
    page_title="AntonRx — Medical Policy Tracker",
    page_icon="💊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Inject mockup design system CSS
inject_styles()

# ─── Sidebar ──────────────────────────────────────────────────────────────────

st.sidebar.markdown("## 💊 AntonRx")
st.sidebar.markdown(
    '<p style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:-8px;">'
    'Drug Policy Tracker v2.0</p>',
    unsafe_allow_html=True,
)
st.sidebar.divider()

# Plan filter
backend_ok = True
try:
    plans = api_client.list_plans()
    plan_options = {p["name"]: p["id"] for p in plans}
except Exception:
    plans = []
    plan_options = {}
    backend_ok = False

if not backend_ok:
    st.sidebar.warning("Backend offline — start with `start.bat`")

st.sidebar.markdown(
    '<p style="font-size:10px;font-weight:600;text-transform:uppercase;'
    'letter-spacing:0.08em;color:rgba(255,255,255,0.35);margin-bottom:4px;">'
    'ANALYST</p>',
    unsafe_allow_html=True,
)

selected_plans = st.sidebar.multiselect(
    "Filter by Health Plan",
    options=list(plan_options.keys()),
    default=list(plan_options.keys()),
    label_visibility="collapsed",
    placeholder="All plans",
)
selected_plan_ids = [plan_options[n] for n in selected_plans]

st.sidebar.divider()

# Status stats
try:
    docs       = api_client.list_documents()
    complete   = sum(1 for d in docs if d["status"] == "complete")
    drugs      = api_client.list_drugs()
    status_dot = "🟢" if backend_ok else "🔴"
    st.sidebar.markdown(
        f'<div style="font-size:12px;color:rgba(255,255,255,0.55);line-height:1.8;">'
        f'{status_dot} API connected<br>'
        f'📋 {len(plans)} plans &nbsp;·&nbsp; {complete}/{len(docs)} docs<br>'
        f'💊 {len(drugs)} drugs indexed'
        f'</div>',
        unsafe_allow_html=True,
    )
except Exception:
    st.sidebar.markdown(
        '<div style="font-size:12px;color:rgba(255,255,255,0.4);">🔴 Backend offline</div>',
        unsafe_allow_html=True,
    )

st.sidebar.divider()
st.sidebar.markdown(
    '<a href="http://localhost:8000/docs" target="_blank" '
    'style="font-size:12px;color:rgba(255,255,255,0.5);">📖 API Docs</a>',
    unsafe_allow_html=True,
)

# ─── Tabs ─────────────────────────────────────────────────────────────────────

tab_ask, tab_compare, tab_coverage, tab_changes, tab_upload, tab_mlops = st.tabs([
    "🤖 Ask AI",
    "⚖️ Compare",
    "🗂️ Coverage Grid",
    "📋 Change Tracker",
    "📤 Upload",
    "🔬 MLOps",
])

with tab_ask:
    ask.render(plans, plan_options, selected_plan_ids)

with tab_compare:
    compare.render(plans, plan_options, selected_plan_ids)

with tab_coverage:
    coverage.render(plans, plan_options, selected_plan_ids)

with tab_changes:
    changes.render(plans, plan_options, selected_plan_ids)

with tab_upload:
    upload.render(plans, plan_options, selected_plan_ids)

with tab_mlops:
    mlops.render(plans, plan_options, selected_plan_ids)
