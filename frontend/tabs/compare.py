import streamlit as st
import pandas as pd
from frontend.utils import api_client


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

                        # Summary table — Benefit Side is first column
                        df = pd.DataFrame([{
                            "Benefit Side": r.get("benefit_side", "unknown") or "unknown",
                            "Plan": r["plan_name"],
                            "Coverage": r["coverage_status"],
                            "PA Required": "Yes" if r["requires_prior_auth"] else "No",
                            "Step Therapy": "Yes" if r["requires_step_therapy"] else "No",
                            "Tier": r.get("tier", ""),
                            "Qty Limit": r.get("quantity_limit", ""),
                            "Data": r.get("data_completeness", "low") or "low",
                        } for r in rows])

                        def highlight_cov(val):
                            if val == "covered": return "background-color: #d4edda"
                            if val == "not_covered": return "background-color: #f8d7da"
                            if val == "covered_with_restrictions": return "background-color: #fff3cd"
                            return ""

                        def highlight_benefit(val):
                            if val == "medical":  return "background-color: #e9d5ff; color: #6b21a8"
                            if val == "pharmacy": return "background-color: #dbeafe; color: #1d4ed8"
                            if val == "both":     return "background-color: #d4edda; color: #155724"
                            return ""

                        st.dataframe(
                            df.style
                              .map(highlight_cov,     subset=["Coverage"])
                              .map(highlight_benefit, subset=["Benefit Side"]),
                            use_container_width=True, hide_index=True
                        )

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
