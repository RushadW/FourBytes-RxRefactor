import streamlit as st
import pandas as pd
from frontend.utils import api_client
from frontend.utils.styles import coverage_badge, benefit_badge, dc_badge, badge


def render(plans, plan_options, selected_plan_ids):
    st.header("Compare Plans Side-by-Side")

    compare_mode = st.radio(
        "Compare mode", ["Drug across all plans", "Two plans full comparison"], horizontal=True
    )

    if compare_mode == "Drug across all plans":
        drug_input = st.text_input("Drug name to compare", placeholder="e.g. adalimumab, secukinumab")

        if drug_input and st.button("⚖️ Compare", type="primary"):
            with st.spinner("Fetching comparison data..."):
                try:
                    result = api_client.compare_drug(
                        drug_name=drug_input,
                        plan_ids=selected_plan_ids if selected_plan_ids else None,
                    )
                    if result.get("comparisons"):
                        st.subheader(
                            f"{result.get('drug_brand_name', result['drug_generic_name'])} "
                            f"({result['drug_generic_name']})"
                        )
                        if result.get("drug_class"):
                            st.caption(f"Drug Class: {result['drug_class']}")

                        rows = result["comparisons"]

                        # ── Mockup-style compare grid ──────────────────────
                        n = len(rows)
                        col_w = f"180px repeat({n}, 1fr)"

                        def _section(title):
                            return (
                                f'<div style="grid-column:1/-1;padding:7px 16px;'
                                f'font-size:11px;font-weight:700;text-transform:uppercase;'
                                f'letter-spacing:.06em;color:#1d4ed8;background:#eff6ff;'
                                f'border-bottom:1px solid #bfdbfe;">{title}</div>'
                            )

                        def _row(label, cells_html):
                            cells = "".join(
                                f'<div style="padding:10px 16px;font-size:13px;color:#334155;'
                                f'border-right:1px solid #f1f5f9;">{c}</div>'
                                for c in cells_html
                            )
                            return (
                                f'<div style="display:grid;grid-template-columns:{col_w};'
                                f'border-bottom:1px solid #f1f5f9;">'
                                f'<div style="padding:10px 16px;font-size:11.5px;font-weight:600;'
                                f'color:#64748b;text-transform:uppercase;letter-spacing:.04em;">'
                                f'{label}</div>{cells}</div>'
                            )

                        headers = "".join(
                            f'<div style="padding:13px 16px;font-size:13px;font-weight:700;'
                            f'color:#0f172a;border-right:1px solid #e2e8f0;">'
                            f'{r["plan_name"]}<div style="font-size:11px;color:#94a3b8;'
                            f'font-weight:400;margin-top:2px;">'
                            f'{r.get("payer_name","")}</div></div>'
                            for r in rows
                        )

                        grid = (
                            f'<div style="background:#fff;border:1px solid #e2e8f0;'
                            f'border-radius:8px;overflow:hidden;'
                            f'box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:16px;">'
                            f'<div style="display:grid;grid-template-columns:{col_w};'
                            f'border-bottom:2px solid #e2e8f0;">'
                            f'<div style="padding:13px 16px;font-size:12px;font-weight:600;'
                            f'color:#64748b;">Field</div>{headers}</div>'
                            + _section("Coverage")
                            + _row("Benefit Side",  [benefit_badge(r.get("benefit_side","")) for r in rows])
                            + _row("Coverage",      [coverage_badge(r["coverage_status"])   for r in rows])
                            + _row("Tier",          [r.get("tier") or "—"                   for r in rows])
                            + _row("Data Quality",  [dc_badge(r.get("data_completeness","low")) for r in rows])
                            + _section("Prior Authorization")
                            + _row("PA Required",
                                   ['<span style="color:#15803d;font-weight:600;">✓ Yes</span>'
                                    if r["requires_prior_auth"] else
                                    '<span style="color:#94a3b8;">✗ No</span>'
                                    for r in rows])
                            + _section("Step Therapy")
                            + _row("Step Tx Required",
                                   ['<span style="color:#15803d;font-weight:600;">✓ Yes</span>'
                                    if r["requires_step_therapy"] else
                                    '<span style="color:#94a3b8;">✗ No</span>'
                                    for r in rows])
                            + _row("Required Agents",
                                   ["<br>".join(
                                       f'<span style="font-size:12px;">• {d}</span>'
                                       for d in (r.get("step_therapy_drugs") or [])
                                   ) or '<span style="color:#94a3b8;">—</span>'
                                    for r in rows])
                            + _section("Quantity Limits")
                            + _row("Qty Limit", [r.get("quantity_limit") or "—" for r in rows])
                            + "</div>"
                        )
                        st.markdown(grid, unsafe_allow_html=True)

                        # Detailed PA criteria per plan — with data completeness badge
                        _dc_badge = {"high": "🟢 High", "medium": "🟡 Medium", "low": "🔴 Low"}
                        st.subheader("Prior Auth Criteria by Plan")
                        cols = st.columns(min(len(rows), 3))
                        for i, row in enumerate(rows):
                            with cols[i % 3]:
                                dc = row.get("data_completeness", "low") or "low"
                                badge = _dc_badge.get(dc, "🔴 Low")
                                st.markdown(f"**{row['plan_name']}** {badge}")
                                if row.get("benefit_side_note"):
                                    st.warning(row["benefit_side_note"])
                                if row.get("prior_auth_criteria"):
                                    for j, crit in enumerate(row["prior_auth_criteria"]):
                                        st.caption(f"{j+1}. {crit}")
                                elif row["coverage_status"] == "not_covered":
                                    st.caption("*Not covered*")
                                else:
                                    st.caption("*No prior auth required*")
                    else:
                        st.warning(f"No coverage data found for '{drug_input}'.")
                except Exception as e:
                    st.error(f"Comparison failed: {e}")

    else:  # Two plans comparison
        if len(plan_options) < 2:
            st.warning("Need at least 2 plans loaded for full comparison.")
        else:
            col1, col2 = st.columns(2)
            with col1:
                plan_a_name = st.selectbox("Plan A", list(plan_options.keys()), key="pa")
            with col2:
                plan_b_name = st.selectbox(
                    "Plan B", list(plan_options.keys()),
                    index=min(1, len(plan_options) - 1), key="pb"
                )

            if plan_a_name != plan_b_name and st.button("⚖️ Compare Plans", type="primary"):
                with st.spinner("Comparing..."):
                    try:
                        result = api_client.compare_plans(
                            plan_id_a=plan_options[plan_a_name],
                            plan_id_b=plan_options[plan_b_name],
                        )
                        st.subheader(f"{plan_a_name} vs {plan_b_name}")

                        c1, c2, c3 = st.columns(3)
                        c1.metric("Differences found",       len(result.get("differences", [])))
                        c2.metric(f"Only in {plan_a_name[:15]}", len(result.get("only_in_plan_a", [])))
                        c3.metric(f"Only in {plan_b_name[:15]}", len(result.get("only_in_plan_b", [])))

                        if result.get("differences"):
                            st.subheader("Policy Differences")
                            df_diff = pd.DataFrame([{
                                "Drug":  d["drug_generic_name"],
                                "Field": d["field"].replace("_", " ").title(),
                                plan_a_name: d["plan_a_value"],
                                plan_b_name: d["plan_b_value"],
                            } for d in result["differences"]])

                            def _highlight_benefit_side(row):
                                if row["Field"] == "Benefit Side":
                                    return ["background-color: #ffe0b2"] * len(row)
                                return [""] * len(row)

                            st.dataframe(
                                df_diff.style.apply(_highlight_benefit_side, axis=1),
                                use_container_width=True, hide_index=True
                            )

                        col_a, col_b = st.columns(2)
                        with col_a:
                            if result.get("only_in_plan_a"):
                                st.subheader(f"Only in {plan_a_name}")
                                for d in result["only_in_plan_a"]:
                                    st.caption(f"• {d}")
                        with col_b:
                            if result.get("only_in_plan_b"):
                                st.subheader(f"Only in {plan_b_name}")
                                for d in result["only_in_plan_b"]:
                                    st.caption(f"• {d}")
                    except Exception as e:
                        st.error(f"Comparison failed: {e}")
