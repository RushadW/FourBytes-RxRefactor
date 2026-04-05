import streamlit as st
import pandas as pd
from frontend.utils import api_client
from frontend.utils.styles import coverage_badge, benefit_badge, dc_badge


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

            # Render as HTML table with mockup badge styling
            st.markdown(
                f'<p style="font-size:12px;color:#64748b;margin-bottom:8px;">'
                f'<strong>{len(df)}</strong> records</p>',
                unsafe_allow_html=True,
            )

            header_cells = "".join(
                f'<th style="text-align:left;padding:10px 14px;font-size:11.5px;'
                f'font-weight:600;text-transform:uppercase;letter-spacing:.05em;'
                f'color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;">'
                f'{col}</th>'
                for col in ["Plan", "Drug (Generic)", "Brand", "Benefit", "Coverage",
                             "PA", "Step Tx", "Tier", "Qty Limit", "Data", "Quarter"]
            )

            rows_html = ""
            for _, row in df.iterrows():
                pa_c  = "#15803d" if row["PA Req"] == "Yes" else "#94a3b8"
                st_c  = "#15803d" if row["Step Therapy"] == "Yes" else "#94a3b8"
                rows_html += f"""<tr style="border-bottom:1px solid #f1f5f9;">
  <td style="padding:10px 14px;font-weight:500;color:#0f172a;font-size:13px;">{row['Plan']}</td>
  <td style="padding:10px 14px;color:#334155;font-size:13px;">{row['Drug (Generic)']}</td>
  <td style="padding:10px 14px;color:#64748b;font-size:12px;">{row['Brand']}</td>
  <td style="padding:10px 14px;">{benefit_badge(row['Benefit Side'])}</td>
  <td style="padding:10px 14px;">{coverage_badge(row['Coverage'])}</td>
  <td style="padding:10px 14px;font-weight:600;font-size:13px;color:{pa_c};">{row['PA Req']}</td>
  <td style="padding:10px 14px;font-weight:600;font-size:13px;color:{st_c};">{row['Step Therapy']}</td>
  <td style="padding:10px 14px;color:#334155;font-size:13px;">{row['Tier'] or '—'}</td>
  <td style="padding:10px 14px;color:#334155;font-size:12px;">{row['Qty Limit'] or '—'}</td>
  <td style="padding:10px 14px;">{dc_badge(row['Data'])}</td>
  <td style="padding:10px 14px;color:#64748b;font-size:12px;">{row['Quarter']}</td>
</tr>"""

            st.markdown(
                f'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;'
                f'overflow-x:auto;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px;">'
                f'<table style="width:100%;border-collapse:collapse;">'
                f'<thead><tr>{header_cells}</tr></thead>'
                f'<tbody>{rows_html}</tbody></table></div>',
                unsafe_allow_html=True,
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
