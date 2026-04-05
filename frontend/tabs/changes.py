import streamlit as st
import pandas as pd
from frontend.utils import api_client


def render(plans, plan_options, selected_plan_ids):
    st.header("Policy Change Tracker")
    st.caption("Track what changed between document versions across payers.")

    col1, col2 = st.columns([2, 1])
    with col1:
        plan_filter = st.selectbox(
            "Filter by plan",
            ["All Plans"] + list(plan_options.keys()),
            key="change_plan_filter",
        )
    with col2:
        change_type_filter = st.multiselect(
            "Change types",
            ["coverage_status_change", "requires_prior_auth_change",
             "tier_change", "requires_step_therapy_change",
             "benefit_side_change", "new_drug", "drug_removed"],
            default=[],
            placeholder="All types",
        )

    if st.button("🔄 Load Changes", use_container_width=False):
        st.rerun()

    try:
        pid = plan_options.get(plan_filter) if plan_filter != "All Plans" else None
        changes = api_client.get_changes(plan_id=pid)

        if change_type_filter:
            changes = [c for c in changes if c["change_type"] in change_type_filter]

        if changes:
            st.caption(f"**{len(changes)} changes detected**")
            df = pd.DataFrame([{
                "Plan": c["plan_name"],
                "Drug": c.get("drug_generic_name", ""),
                "Change Type": c["change_type"].replace("_", " ").title(),
                "From": c.get("old_value", ""),
                "To": c.get("new_value", ""),
                "From Quarter": c.get("from_quarter", "Initial"),
                "To Quarter": c.get("to_quarter", ""),
                "Detected": c["detected_at"][:10] if c.get("detected_at") else "",
            } for c in changes])

            def highlight_change_type(val):
                if "Status" in val:    return "background-color: #fff3cd"
                if "Auth" in val:      return "background-color: #f8d7da"
                if "Benefit" in val:   return "background-color: #ffe0b2"
                if "Step" in val:      return "background-color: #cfe2ff"
                return ""

            st.dataframe(
                df.style.map(highlight_change_type, subset=["Change Type"]),
                use_container_width=True, hide_index=True, height=400
            )

            csv = df.to_csv(index=False)
            st.download_button(
                "⬇️ Export Changes CSV", data=csv,
                file_name="policy_changes.csv", mime="text/csv"
            )
        else:
            st.info(
                "No policy changes detected yet. "
                "Upload multiple versions of the same plan's policy to track changes."
            )
    except Exception as e:
        st.error(f"Could not load changes: {e}")
