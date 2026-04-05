"""
AntonRx — Streamlit frontend entry point.
Tab logic lives in frontend/tabs/*.py for easy editing.
"""
import sys
import os

# Add project root to path so imports work from any working directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from frontend.utils import api_client
from frontend.tabs import upload, ask, coverage, compare, changes, mlops

st.set_page_config(
    page_title="AntonRx — Medical Policy Tracker",
    page_icon="💊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Sidebar ──────────────────────────────────────────────────────────────────

st.sidebar.title("💊 AntonRx")
st.sidebar.caption("Medical benefit drug policy tracker — v2.0")

try:
    plans = api_client.list_plans()
    plan_options = {p["name"]: p["id"] for p in plans}
except Exception:
    plans = []
    plan_options = {}
    st.sidebar.warning(
        "Backend not running.  \n"
        "Start with: `uvicorn backend.main:app --reload --port 8000`"
    )

selected_plans = st.sidebar.multiselect(
    "Filter by Health Plan",
    options=list(plan_options.keys()),
    default=list(plan_options.keys()),
)
selected_plan_ids = [plan_options[n] for n in selected_plans]

st.sidebar.divider()
st.sidebar.caption(f"**{len(plans)} plans loaded**")
try:
    docs = api_client.list_documents()
    complete = sum(1 for d in docs if d["status"] == "complete")
    st.sidebar.caption(f"**{complete}/{len(docs)} documents processed**")
    drugs = api_client.list_drugs()
    st.sidebar.caption(f"**{len(drugs)} drugs indexed**")
except Exception:
    pass

st.sidebar.divider()
st.sidebar.caption("🔗 [API Docs](http://localhost:8000/docs)")

# ─── Tabs ─────────────────────────────────────────────────────────────────────

tab_upload, tab_ask, tab_coverage, tab_compare, tab_changes, tab_mlops = st.tabs([
    "📤 Upload", "🤖 Ask AI", "📊 Coverage Grid",
    "⚖️ Compare Plans", "📅 Change Tracker", "🔬 MLOps",
])

with tab_upload:
    upload.render(plans, plan_options, selected_plan_ids)

with tab_ask:
    ask.render(plans, plan_options, selected_plan_ids)

with tab_coverage:
    coverage.render(plans, plan_options, selected_plan_ids)

with tab_compare:
    compare.render(plans, plan_options, selected_plan_ids)

with tab_changes:
    changes.render(plans, plan_options, selected_plan_ids)

with tab_mlops:
    mlops.render(plans, plan_options, selected_plan_ids)
