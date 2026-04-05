import streamlit as st
import pandas as pd
from frontend.utils import api_client


def render(plans, plan_options, selected_plan_ids):
    st.header("Ask AI About Drug Policies")
    st.caption("Natural language queries powered by Claude with RAG over your loaded policies.")

    example_questions = [
        "Does Florida Blue require step therapy for adalimumab in RA patients?",
        "What's the benefit side for Cigna's adalimumab policy?",
        "Compare prior auth criteria for adalimumab across all plans",
        "What changed in Florida Blue policy from Q1 to Q2 2026?",
        "Which plans cover secukinumab without prior auth?",
    ]

    col1, col2 = st.columns([3, 1])
    with col1:
        question = st.text_area(
            "Your question",
            height=80,
            placeholder="e.g. Does Florida Blue require step therapy for adalimumab in RA?",
        )
    with col2:
        st.caption("**Example questions:**")
        for ex in example_questions:
            if st.button(ex, key=f"ex_{ex[:20]}", use_container_width=True):
                st.session_state["prefill_q"] = ex

    if "prefill_q" in st.session_state:
        question = st.session_state.pop("prefill_q")

    filter_plans = st.checkbox("Filter to selected plans only", value=False)

    if st.button("🔍 Ask", type="primary", disabled=not question.strip()):
        with st.spinner("Searching policies and generating answer..."):
            try:
                result = api_client.ask(
                    question=question,
                    plan_ids=selected_plan_ids if filter_plans and selected_plan_ids else None,
                )
                st.markdown("### Answer")
                st.markdown(result["answer"])

                tier = result.get("routing_tier", "tier_3_rag")
                cost = result.get("source_cost", "")
                cache_hit = result.get("cache_hit", False)
                tier_labels = {
                    "tier_1_structured": "🗃 Tier 1 — answered from structured DB (no LLM call)",
                    "tier_2_synthesis":  "⚡ Tier 2 — synthesized from structured data",
                    "tier_3_rag":        "🔍 Tier 3 — full RAG retrieval",
                }
                cache_note = "  |  ⚡ Cache hit" if cache_hit else ""
                st.caption(f"{tier_labels.get(tier, tier)}  |  Cost: {cost}{cache_note}")

                if result.get("structured_hits"):
                    st.markdown("### Matching Coverage Records")
                    rows = result["structured_hits"]
                    df = pd.DataFrame([{
                        "Plan": r["plan_name"],
                        "Drug": r["drug_generic_name"],
                        "Benefit Side": r.get("benefit_side", "unknown") or "unknown",
                        "Coverage": r["coverage_status"],
                        "Prior Auth": "✓" if r["requires_prior_auth"] else "✗",
                        "Step Therapy": "✓" if r["requires_step_therapy"] else "✗",
                        "Tier": r.get("tier", ""),
                        "Data": r.get("data_completeness", "low") or "low",
                    } for r in rows])

                    def _cov_color(val):
                        if val == "covered": return "background-color: #d4edda"
                        if val == "not_covered": return "background-color: #f8d7da"
                        if val == "covered_with_restrictions": return "background-color: #fff3cd"
                        return ""

                    def _dc_color(val):
                        if val == "high":   return "color: #155724; font-weight:600"
                        if val == "medium": return "color: #856404; font-weight:600"
                        return "color: #721c24; font-weight:600"

                    st.dataframe(
                        df.style.map(_cov_color, subset=["Coverage"]).map(_dc_color, subset=["Data"]),
                        use_container_width=True, hide_index=True
                    )

                if result.get("sources"):
                    with st.expander(f"📄 Sources ({len(result['sources'])} chunks)"):
                        for i, src in enumerate(result["sources"]):
                            st.markdown(
                                f"**Source {i+1}:** {src['plan_name']} — "
                                f"{src['document_name']} (page {src.get('page_number', '?')})"
                            )
                            st.caption(src["chunk_text"])
                            st.divider()
            except Exception as e:
                st.error(f"Query failed: {e}")
