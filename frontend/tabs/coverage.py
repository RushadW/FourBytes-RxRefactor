import streamlit as st
import pandas as pd
from frontend.utils import api_client


def render(plans, plan_options, selected_plan_ids):
    st.header("Drug Coverage Grid")
    st.caption("See how all loaded plans cover every drug at a glance.")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        drug_filter = st.text_input("Filter by drug name", placeholder="e.g. adalimumab")
    with col2:
        status_filter = st.multiselect(
            "Coverage status",
            ["covered", "not_covered", "covered_with_restrictions"],
            default=["covered", "not_covered", "covered_with_restrictions"],
        )
    with col3:
        pa_filter = st.selectbox("Prior auth required", ["All", "Yes", "No"])
    with col4:
        benefit_side_filter = st.selectbox(
            "Benefit side", ["All", "medical", "pharmacy", "both", "unknown"]
        )

    if st.button("🔄 Refresh Grid", use_container_width=False):
        st.rerun()

    try:
        if drug_filter:
            rows = api_client.get_coverage(
                drug_name=drug_filter,
                plan_ids=selected_plan_ids if selected_plan_ids else None,
            )
        else:
            rows = api_client.get_all_coverage(
                plan_ids=selected_plan_ids if selected_plan_ids else None,
            )

        if rows:
            df = pd.DataFrame([{
                "Plan": r["plan_name"],
                "Drug (Generic)": r["drug_generic_name"],
                "Brand": r.get("drug_brand_name", ""),
                "Class": r.get("drug_class", ""),
                "Benefit Side": r.get("benefit_side", "unknown") or "unknown",
                "Coverage": r["coverage_status"],
                "PA Req": "Yes" if r["requires_prior_auth"] else "No",
                "Step Therapy": "Yes" if r["requires_step_therapy"] else "No",
                "Tier": r.get("tier", ""),
                "Qty Limit": r.get("quantity_limit", ""),
                "Data": r.get("data_completeness", "low") or "low",
                "Quarter": r.get("quarter", ""),
            } for r in rows])

            # Apply filters
            if status_filter:
                df = df[df["Coverage"].isin(status_filter)]
            if pa_filter == "Yes":
                df = df[df["PA Req"] == "Yes"]
            elif pa_filter == "No":
                df = df[df["PA Req"] == "No"]
            if benefit_side_filter != "All":
                df = df[df["Benefit Side"] == benefit_side_filter]

            def highlight_coverage(val):
                if val == "covered":                    return "background-color: #d4edda; color: #155724"
                if val == "not_covered":                return "background-color: #f8d7da; color: #721c24"
                if val == "covered_with_restrictions":  return "background-color: #fff3cd; color: #856404"
                return ""

            def highlight_benefit(val):
                if val == "medical":  return "background-color: #e9d5ff; color: #6b21a8"
                if val == "pharmacy": return "background-color: #dbeafe; color: #1d4ed8"
                if val == "both":     return "background-color: #d4edda; color: #155724"
                return ""

            st.caption(f"**{len(df)} records**")
            st.dataframe(
                df.style
                  .map(highlight_coverage, subset=["Coverage"])
                  .map(highlight_benefit,  subset=["Benefit Side"]),
                use_container_width=True,
                hide_index=True,
                height=500,
            )

            csv = df.to_csv(index=False)
            st.download_button(
                "⬇️ Export CSV", data=csv,
                file_name="coverage_grid.csv", mime="text/csv"
            )
        else:
            st.info("No coverage data found. Upload and process policy documents first.")
    except Exception as e:
        st.error(f"Could not load coverage data: {e}")
