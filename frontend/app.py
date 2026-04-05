import streamlit as st
import pandas as pd
import sys
import os

# Add project root to path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from frontend.utils import api_client

st.set_page_config(
    page_title="Medical Policy Tracker",
    page_icon="💊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Sidebar ──────────────────────────────────────────────────────────────────

st.sidebar.title("💊 MedPolicy Tracker")
st.sidebar.caption("AI-powered medical benefit drug policy comparison")

try:
    plans = api_client.list_plans()
    plan_options = {p["name"]: p["id"] for p in plans}
except Exception:
    plans = []
    plan_options = {}
    st.sidebar.warning("Backend not running. Start with `uvicorn backend.main:app --reload`")

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

# ─── Tabs ─────────────────────────────────────────────────────────────────────

tab_upload, tab_ask, tab_coverage, tab_compare, tab_changes, tab_mlops = st.tabs([
    "📤 Upload", "🤖 Ask AI", "📊 Coverage Grid", "⚖️ Compare Plans",
    "📅 Change Tracker", "🔬 MLOps"
])


# ─── Upload Tab ───────────────────────────────────────────────────────────────
with tab_upload:
    st.header("Upload Policy Documents")
    st.caption("Upload PDF or TXT medical benefit drug policy documents. Claude will extract structured data automatically.")

    col1, col2 = st.columns([2, 1])

    with col1:
        uploaded_file = st.file_uploader(
            "Choose a policy document",
            type=["pdf", "txt"],
            help="PDFs and text files are supported",
        )

    with col2:
        plan_name = st.text_input("Health Plan Name *", placeholder="e.g. Aetna Commercial 2025")
        payer_name = st.text_input("Payer Name *", placeholder="e.g. Aetna")
        plan_type = st.selectbox("Plan Type", ["Commercial", "Medicare Advantage", "Medicaid", "Other"])
        quarter = st.text_input("Quarter", placeholder="e.g. Q1 2025")
        effective_date = st.date_input("Effective Date", value=None)
        doc_type = st.selectbox("Document Type", ["clinical_policy", "dqm_policy", "formulary_book", "other"])
        drug_hint = st.text_input("Primary Drug Focus", placeholder="e.g. adalimumab (optional)")
        benefit_side_upload = st.selectbox("Benefit Side", ["unknown", "medical", "pharmacy", "both"])

    if uploaded_file and plan_name and payer_name:
        if st.button("🚀 Upload & Process", type="primary", use_container_width=True):
            with st.spinner("Uploading document..."):
                try:
                    upload_resp = api_client.upload_document(
                        file_bytes=uploaded_file.read(),
                        filename=uploaded_file.name,
                        plan_name=plan_name,
                        payer_name=payer_name,
                        plan_type=plan_type,
                        effective_date=str(effective_date) if effective_date else None,
                        quarter=quarter or None,
                        doc_type=doc_type,
                        drug=drug_hint or None,
                        benefit_side=benefit_side_upload,
                    )
                    doc_id = upload_resp["document_id"]
                    st.success(f"Uploaded! Document ID: {doc_id}")
                except Exception as e:
                    st.error(f"Upload failed: {e}")
                    doc_id = None

            if doc_id and upload_resp.get("status") != "complete":
                with st.spinner("Processing with Claude AI... (this may take 30-90 seconds)"):
                    try:
                        result = api_client.process_document(doc_id)
                        if result["status"] == "complete":
                            st.success(
                                f"✅ Processing complete!\n\n"
                                f"- **{result['drugs_extracted']}** drugs extracted\n"
                                f"- **{result['policies_created']}** new coverage policies\n"
                                f"- **{result['changes_detected']}** policy changes detected"
                            )
                            st.rerun()
                        else:
                            st.error(f"Processing failed: {result.get('error')}")
                    except Exception as e:
                        st.error(f"Processing error: {e}")
    elif uploaded_file:
        st.info("Fill in Plan Name and Payer Name to enable upload.")

    st.divider()
    st.subheader("Loaded Documents")
    try:
        docs = api_client.list_documents()
        if docs:
            df = pd.DataFrame(docs)[["filename", "plan_name", "quarter", "version",
                                     "status", "uploaded_at"]]
            df.columns = ["File", "Plan", "Quarter", "Ver", "Status", "Uploaded"]

            def status_color(val):
                colors = {"complete": "background-color: #d4edda",
                          "failed": "background-color: #f8d7da",
                          "processing": "background-color: #fff3cd",
                          "pending": "background-color: #e2e3e5"}
                return colors.get(val, "")

            st.dataframe(
                df.style.applymap(status_color, subset=["Status"]),
                use_container_width=True,
                hide_index=True,
            )

            # Delete option
            del_id = st.number_input("Delete document by ID", min_value=0, step=1, value=0)
            if del_id > 0 and st.button("🗑️ Delete", type="secondary"):
                try:
                    api_client.delete_document(int(del_id))
                    st.success(f"Document {del_id} deleted.")
                    st.rerun()
                except Exception as e:
                    st.error(f"Delete failed: {e}")
        else:
            st.info("No documents uploaded yet.")
    except Exception as e:
        st.error(f"Could not load documents: {e}")


# ─── Ask AI Tab ───────────────────────────────────────────────────────────────
with tab_ask:
    st.header("Ask AI About Drug Policies")
    st.caption("Natural language queries powered by Claude with RAG over your loaded policies.")

    example_questions = [
        "Which plans cover adalimumab (Humira)?",
        "What prior authorization criteria does Aetna require for semaglutide?",
        "Does any plan require step therapy for dupilumab?",
        "What changed in Cigna's biologics policy this quarter?",
        "Which plan has the least restrictive coverage for pembrolizumab?",
    ]

    col1, col2 = st.columns([3, 1])
    with col1:
        question = st.text_area(
            "Your question",
            height=80,
            placeholder="e.g. Which plans cover Drug X? What prior auth criteria does Plan Y require for Drug Z?",
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
                tier_labels = {
                    "tier_1_structured": "🗃 Tier 1 — answered from structured DB (no LLM call)",
                    "tier_2_synthesis": "⚡ Tier 2 — synthesized from structured data",
                    "tier_3_rag": "🔍 Tier 3 — full RAG retrieval",
                }
                st.caption(f"{tier_labels.get(tier, tier)}  |  Cost: {cost}")

                if result.get("structured_hits"):
                    st.markdown("### Matching Coverage Records")
                    rows = result["structured_hits"]
                    df = pd.DataFrame([{
                        "Plan": r["plan_name"],
                        "Drug": r["drug_generic_name"],
                        "Coverage": r["coverage_status"],
                        "Prior Auth": "✓" if r["requires_prior_auth"] else "✗",
                        "Step Therapy": "✓" if r["requires_step_therapy"] else "✗",
                        "Tier": r.get("tier", ""),
                    } for r in rows])
                    st.dataframe(df, use_container_width=True, hide_index=True)

                if result.get("sources"):
                    with st.expander(f"📄 Sources ({len(result['sources'])} chunks)"):
                        for i, src in enumerate(result["sources"]):
                            st.markdown(f"**Source {i+1}:** {src['plan_name']} — {src['document_name']} (page {src.get('page_number', '?')})")
                            st.caption(src["chunk_text"])
                            st.divider()
            except Exception as e:
                st.error(f"Query failed: {e}")


# ─── Coverage Grid Tab ────────────────────────────────────────────────────────
with tab_coverage:
    st.header("Drug Coverage Grid")
    st.caption("See how all loaded plans cover every drug at a glance.")

    col1, col2, col3 = st.columns(3)
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
                "Coverage": r["coverage_status"],
                "PA Req": "Yes" if r["requires_prior_auth"] else "No",
                "Step Therapy": "Yes" if r["requires_step_therapy"] else "No",
                "Tier": r.get("tier", ""),
                "Qty Limit": r.get("quantity_limit", ""),
                "Quarter": r.get("quarter", ""),
            } for r in rows])

            # Apply filters
            if status_filter:
                df = df[df["Coverage"].isin(status_filter)]
            if pa_filter == "Yes":
                df = df[df["PA Req"] == "Yes"]
            elif pa_filter == "No":
                df = df[df["PA Req"] == "No"]

            def highlight_coverage(val):
                if val == "covered":
                    return "background-color: #d4edda; color: #155724"
                elif val == "not_covered":
                    return "background-color: #f8d7da; color: #721c24"
                elif val == "covered_with_restrictions":
                    return "background-color: #fff3cd; color: #856404"
                return ""

            st.caption(f"**{len(df)} records**")
            st.dataframe(
                df.style.applymap(highlight_coverage, subset=["Coverage"]),
                use_container_width=True,
                hide_index=True,
                height=500,
            )

            # Export
            csv = df.to_csv(index=False)
            st.download_button("⬇️ Export CSV", data=csv,
                               file_name="coverage_grid.csv", mime="text/csv")
        else:
            st.info("No coverage data found. Upload and process policy documents first.")
    except Exception as e:
        st.error(f"Could not load coverage data: {e}")


# ─── Compare Plans Tab ────────────────────────────────────────────────────────
with tab_compare:
    st.header("Compare Plans Side-by-Side")

    compare_mode = st.radio("Compare mode", ["Drug across all plans", "Two plans full comparison"],
                            horizontal=True)

    if compare_mode == "Drug across all plans":
        drug_input = st.text_input("Drug name to compare", placeholder="e.g. adalimumab, semaglutide")

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
                            "# PA Criteria": len(r.get("prior_auth_criteria", [])),
                            "# Step Drugs": len(r.get("step_therapy_drugs", [])),
                        } for r in rows])

                        def highlight_cov(val):
                            if val == "covered": return "background-color: #d4edda"
                            if val == "not_covered": return "background-color: #f8d7da"
                            if val == "covered_with_restrictions": return "background-color: #fff3cd"
                            return ""

                        st.dataframe(
                            df.style.applymap(highlight_cov, subset=["Coverage"]),
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
                plan_b_name = st.selectbox("Plan B", list(plan_options.keys()),
                                           index=min(1, len(plan_options) - 1), key="pb")

            if plan_a_name != plan_b_name and st.button("⚖️ Compare Plans", type="primary"):
                with st.spinner("Comparing..."):
                    try:
                        result = api_client.compare_plans(
                            plan_id_a=plan_options[plan_a_name],
                            plan_id_b=plan_options[plan_b_name],
                        )
                        st.subheader(f"{plan_a_name} vs {plan_b_name}")

                        c1, c2, c3 = st.columns(3)
                        c1.metric("Differences found", len(result.get("differences", [])))
                        c2.metric(f"Only in {plan_a_name[:15]}", len(result.get("only_in_plan_a", [])))
                        c3.metric(f"Only in {plan_b_name[:15]}", len(result.get("only_in_plan_b", [])))

                        if result.get("differences"):
                            st.subheader("Policy Differences")
                            df_diff = pd.DataFrame([{
                                "Drug": d["drug_generic_name"],
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


# ─── Change Tracker Tab ───────────────────────────────────────────────────────
with tab_changes:
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
             "tier_change", "requires_step_therapy_change", "new_drug", "drug_removed"],
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

            st.dataframe(df, use_container_width=True, hide_index=True, height=400)

            csv = df.to_csv(index=False)
            st.download_button("⬇️ Export Changes CSV", data=csv,
                               file_name="policy_changes.csv", mime="text/csv")
        else:
            st.info(
                "No policy changes detected yet. "
                "Upload multiple versions of the same plan's policy to track changes."
            )
    except Exception as e:
        st.error(f"Could not load changes: {e}")


# ─── MLOps Dashboard Tab ──────────────────────────────────────────────────────
with tab_mlops:
    st.header("MLOps Dashboard")
    st.caption("Monitor LLM costs, extraction quality, data drift, and manage prompts.")

    mlops_tab = st.radio(
        "Section",
        ["LLM Observability", "Extraction Quality", "RAG Quality",
         "Data Drift", "Prompt Registry", "Cache", "Re-extraction Jobs"],
        horizontal=True,
        label_visibility="collapsed",
    )

    # ── LLM Observability ────────────────────────────────────────────────────
    if mlops_tab == "LLM Observability":
        st.subheader("LLM Call Observability")
        try:
            summary = api_client._get("/mlops/observability/summary")
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Total Calls", summary["total_calls"])
            c2.metric("Total Cost (USD)", f"${summary['total_cost_usd']:.4f}")
            c3.metric("Input Tokens", f"{summary['total_input_tokens']:,}")
            c4.metric("Output Tokens", f"{summary['total_output_tokens']:,}")

            by_type = summary.get("by_call_type", {})
            if by_type:
                st.subheader("Breakdown by Call Type")
                df = pd.DataFrame([
                    {"Call Type": k, "Calls": v["calls"],
                     "Cost ($)": round(v["cost_usd"], 5),
                     "Input Tokens": v["input_tokens"],
                     "Output Tokens": v["output_tokens"],
                     "Avg Latency (ms)": v["avg_latency_ms"]}
                    for k, v in by_type.items()
                ])
                st.dataframe(df, use_container_width=True, hide_index=True)

            st.subheader("Recent Calls")
            calls = api_client._get("/mlops/observability/calls", {"limit": 20})
            if calls:
                df_calls = pd.DataFrame([{
                    "Type": c["call_type"], "Tokens In": c["input_tokens"],
                    "Tokens Out": c["output_tokens"],
                    "Latency (ms)": c["latency_ms"],
                    "Cost ($)": round(c["cost_usd"] or 0, 5),
                    "Stop": c["stop_reason"],
                    "Error": c["error"] or "",
                    "Doc ID": c["document_id"] or "",
                    "At": str(c["called_at"])[:19],
                } for c in calls])
                st.dataframe(df_calls, use_container_width=True, hide_index=True)
        except Exception as e:
            st.error(f"Could not load observability data: {e}")

    # ── Extraction Quality ────────────────────────────────────────────────────
    elif mlops_tab == "Extraction Quality":
        st.subheader("Extraction Quality Scores")
        try:
            scores = api_client._get("/mlops/quality/extraction", {"limit": 50})
            if scores:
                df = pd.DataFrame([{
                    "Doc ID": s["document_id"],
                    "Drugs": s["drugs_extracted"],
                    "Completeness": f"{s['schema_completeness_avg']:.0%}",
                    "Req Fields Pass": f"{s['required_fields_pass']:.0%}",
                    "Enum Valid": f"{s['enum_validity_rate']:.0%}",
                    "Anomalies": s["anomaly_count"],
                    "Scored At": str(s["scored_at"])[:19],
                } for s in scores])

                def highlight_completeness(val):
                    try:
                        v = float(val.strip("%")) / 100
                        if v >= 0.8: return "background-color: #d4edda"
                        if v >= 0.5: return "background-color: #fff3cd"
                        return "background-color: #f8d7da"
                    except Exception:
                        return ""

                st.dataframe(
                    df.style.applymap(highlight_completeness, subset=["Completeness"]),
                    use_container_width=True, hide_index=True,
                )

                low_quality = api_client._get("/mlops/quality/low_quality_docs", {"threshold": 0.5})
                if low_quality:
                    st.warning(f"{len(low_quality)} document(s) below quality threshold (completeness < 50%)")
                    st.dataframe(pd.DataFrame(low_quality), use_container_width=True, hide_index=True)
            else:
                st.info("No extraction scores yet. Upload and process documents first.")
        except Exception as e:
            st.error(f"Could not load extraction scores: {e}")

    # ── RAG Quality ───────────────────────────────────────────────────────────
    elif mlops_tab == "RAG Quality":
        st.subheader("RAG Response Quality")
        try:
            summary = api_client._get("/mlops/quality/rag/summary")
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Total Queries", summary.get("total_queries", 0))
            c2.metric("Avg Context Relevance",
                      f"{summary.get('avg_context_relevance', 0):.2f}")
            c3.metric("Avg Groundedness",
                      f"{summary.get('avg_groundedness', 0):.2f}")
            c4.metric("Avg Human Rating",
                      f"{summary.get('avg_human_rating', 'N/A')}" if summary.get('avg_human_rating') else "N/A")

            scores = api_client._get("/mlops/quality/rag", {"limit": 30})
            if scores:
                df = pd.DataFrame([{
                    "ID": s["id"],
                    "Question": s["question"][:60],
                    "Context Rel.": round(s["context_relevance_score"] or 0, 3),
                    "Groundedness": round(s["groundedness_score"] or 0, 3),
                    "Chunks": s["chunks_retrieved"],
                    "Human Rating": s["human_rating"] or "",
                } for s in scores])
                st.dataframe(df, use_container_width=True, hide_index=True)

                st.subheader("Submit Analyst Feedback")
                score_id = st.number_input("RAG Score ID", min_value=1, step=1)
                rating = st.slider("Rating (1-5)", 1, 5, 3)
                comment = st.text_input("Comment (optional)")
                if st.button("Submit Rating"):
                    try:
                        api_client._post(f"/mlops/quality/rag/{score_id}/feedback",
                                         json={"rating": rating, "comment": comment})
                        st.success("Feedback recorded!")
                    except Exception as e:
                        st.error(f"Failed: {e}")
        except Exception as e:
            st.error(f"Could not load RAG scores: {e}")

    # ── Data Drift ────────────────────────────────────────────────────────────
    elif mlops_tab == "Data Drift":
        st.subheader("Data Drift Events")
        try:
            events = api_client._get("/mlops/drift/events",
                                     {"limit": 50, "acknowledged": "false"})
            if events:
                severity_color = {
                    "critical": "background-color: #f8d7da",
                    "warning": "background-color: #fff3cd",
                    "info": "background-color: #d1ecf1",
                }
                df = pd.DataFrame([{
                    "ID": e["id"], "Type": e["drift_type"].replace("_", " ").title(),
                    "Plan": e.get("plan_id", ""),
                    "Severity": e["severity"],
                    "Description": e["description"][:80],
                    "Detected": str(e["detected_at"])[:19],
                } for e in events])
                st.dataframe(
                    df.style.applymap(
                        lambda v: severity_color.get(v, ""),
                        subset=["Severity"]
                    ),
                    use_container_width=True, hide_index=True,
                )
                ack_id = st.number_input("Acknowledge event ID", min_value=0, step=1, value=0)
                if ack_id > 0 and st.button("Acknowledge"):
                    try:
                        api_client._get(f"/mlops/drift/events/{ack_id}/acknowledge")
                        st.success("Acknowledged")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed: {e}")
            else:
                st.success("No unacknowledged drift events.")
        except Exception as e:
            st.error(f"Could not load drift events: {e}")

    # ── Prompt Registry ───────────────────────────────────────────────────────
    elif mlops_tab == "Prompt Registry":
        st.subheader("Prompt Version Manager")
        try:
            prompts = api_client._get("/mlops/prompts")
            if prompts:
                df = pd.DataFrame([{
                    "ID": p["id"], "Name": p["prompt_name"], "Version": p["version_tag"],
                    "Status": p["status"], "Notes": p.get("notes", ""),
                    "Promoted": str(p.get("promoted_at", ""))[:10],
                } for p in prompts])

                def status_color(val):
                    return {"production": "background-color: #d4edda",
                            "staging": "background-color: #fff3cd",
                            "draft": "background-color: #e2e3e5",
                            "archived": "background-color: #f8d7da"}.get(val, "")

                st.dataframe(
                    df.style.applymap(status_color, subset=["Status"]),
                    use_container_width=True, hide_index=True,
                )

            st.divider()
            col1, col2 = st.columns(2)
            with col1:
                st.subheader("Promote Prompt")
                promote_id = st.number_input("Prompt version ID to promote", min_value=1, step=1)
                if st.button("Promote (draft→staging→production)", type="primary"):
                    try:
                        result = api_client._get(f"/mlops/prompts/{promote_id}/promote")
                        st.success(f"Promoted! {result.get('message', '')}")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed: {e}")
            with col2:
                st.subheader("Create Draft Prompt")
                pname = st.selectbox("Prompt name", [
                    "extraction_system", "extraction_user", "rag_system", "intent_system"
                ])
                vtag = st.text_input("Version tag", placeholder="v1.1")
                sys_p = st.text_area("System prompt", height=100)
                user_p = st.text_area("User prompt template", height=100)
                notes_p = st.text_input("Notes")
                if st.button("Create Draft"):
                    try:
                        api_client._post("/mlops/prompts", json={
                            "prompt_name": pname, "version_tag": vtag,
                            "system_prompt": sys_p or None, "user_prompt": user_p or None,
                            "notes": notes_p or None,
                        })
                        st.success("Draft created!")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed: {e}")
        except Exception as e:
            st.error(f"Could not load prompts: {e}")

    # ── Cache ─────────────────────────────────────────────────────────────────
    elif mlops_tab == "Cache":
        st.subheader("Semantic Query Cache")
        try:
            stats = api_client._get("/mlops/cache/stats")
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Total Entries", stats["total_entries"])
            c2.metric("Active", stats["active_entries"])
            c3.metric("Invalidated", stats["invalidated_entries"])
            c4.metric("Total Hits", stats["total_cache_hits"])

            col1, col2 = st.columns(2)
            with col1:
                inv_plan = st.number_input("Invalidate by plan ID", min_value=0, step=1, value=0)
                if inv_plan > 0 and st.button("Invalidate Plan Cache"):
                    api_client._post("/mlops/cache/invalidate", json={"plan_id": inv_plan})
                    st.success(f"Cache invalidated for plan {inv_plan}")
                    st.rerun()
            with col2:
                if st.button("Invalidate ALL Cache", type="secondary"):
                    api_client._post("/mlops/cache/invalidate", json={"all_entries": True})
                    st.success("All cache entries invalidated")
                    st.rerun()
        except Exception as e:
            st.error(f"Could not load cache stats: {e}")

    # ── Re-extraction Jobs ────────────────────────────────────────────────────
    elif mlops_tab == "Re-extraction Jobs":
        st.subheader("Re-extraction Job Queue")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Run Next Queued Job", type="primary"):
                with st.spinner("Processing..."):
                    try:
                        result = api_client._post("/mlops/reextract/run_next")
                        st.success(f"Result: {result}")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Failed: {e}")
        with col2:
            manual_doc_id = st.number_input("Queue document ID for re-extraction",
                                            min_value=0, step=1, value=0)
            if manual_doc_id > 0 and st.button("Queue"):
                try:
                    api_client._post("/mlops/reextract/queue",
                                     json={"document_ids": [manual_doc_id], "reason": "manual"})
                    st.success(f"Queued doc {manual_doc_id}")
                except Exception as e:
                    st.error(f"Failed: {e}")

        try:
            jobs = api_client._get("/mlops/reextract/jobs", {"limit": 30})
            if jobs:
                df = pd.DataFrame([{
                    "ID": j["id"], "Doc ID": j["document_id"],
                    "Reason": j["trigger_reason"], "Status": j["status"],
                    "Created": str(j["created_at"])[:19],
                    "Completed": str(j.get("completed_at", ""))[:19],
                    "Error": j.get("error_message") or "",
                } for j in jobs])
                st.dataframe(df, use_container_width=True, hide_index=True)
            else:
                st.info("No re-extraction jobs.")
        except Exception as e:
            st.error(f"Could not load jobs: {e}")
