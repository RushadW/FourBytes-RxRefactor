import streamlit as st
import pandas as pd
from frontend.utils import api_client


def render(plans, plan_options, selected_plan_ids):
    st.header("MLOps Dashboard")
    st.caption("Monitor LLM costs, extraction quality, data drift, and manage prompts.")

    mlops_tab = st.radio(
        "Section",
        ["LLM Observability", "Extraction Quality", "RAG Quality",
         "Data Drift", "Prompt Registry", "Cache", "Re-extraction Jobs", "Analyst Corrections"],
        horizontal=True,
        label_visibility="collapsed",
    )

    # ── LLM Observability ────────────────────────────────────────────────────
    if mlops_tab == "LLM Observability":
        st.subheader("LLM Call Observability")
        try:
            summary = api_client._get("/mlops/observability/summary")
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Total Calls",       summary["total_calls"])
            c2.metric("Total Cost (USD)",  f"${summary['total_cost_usd']:.4f}")
            c3.metric("Input Tokens",      f"{summary['total_input_tokens']:,}")
            c4.metric("Output Tokens",     f"{summary['total_output_tokens']:,}")

            by_type = summary.get("by_call_type", {})
            if by_type:
                st.subheader("Breakdown by Call Type")
                df = pd.DataFrame([
                    {"Call Type": k, "Calls": v["calls"],
                     "Cost ($)": round(v.get("cost_usd", v.get("cost", 0)), 5),
                     "Input Tokens": v.get("input_tokens", 0),
                     "Output Tokens": v.get("output_tokens", 0),
                     "Avg Latency (ms)": v.get("avg_latency_ms", 0)}
                    for k, v in by_type.items()
                ])
                st.dataframe(df, use_container_width=True, hide_index=True)

            st.subheader("Recent Calls")
            calls = api_client._get("/mlops/observability/calls", {"limit": 20})
            if calls:
                df_calls = pd.DataFrame([{
                    "Type": c["call_type"],
                    "Tokens In": c["input_tokens"],
                    "Tokens Out": c["output_tokens"],
                    "Latency (ms)": c["latency_ms"],
                    "Cost ($)": round(c.get("cost_usd") or 0, 5),
                    "Stop": c.get("stop_reason", ""),
                    "Error": c.get("error") or "",
                    "Doc ID": c.get("document_id") or "",
                    "At": str(c.get("called_at", ""))[:19],
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
                    "Enum Valid": f"{s.get('enum_validity_rate', 0):.0%}",
                    "Anomalies": s["anomaly_count"],
                    "Scored At": str(s.get("scored_at", ""))[:19],
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
                    df.style.map(highlight_completeness, subset=["Completeness"]),
                    use_container_width=True, hide_index=True,
                )

                try:
                    low_quality = api_client._get("/mlops/quality/low_quality_docs", {"threshold": 0.5})
                    if low_quality:
                        st.warning(f"{len(low_quality)} document(s) below quality threshold (completeness < 50%)")
                        st.dataframe(pd.DataFrame(low_quality), use_container_width=True, hide_index=True)
                except Exception:
                    pass
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
            c1.metric("Total Queries",        summary.get("total_queries", 0))
            c2.metric("Avg Context Relevance", f"{summary.get('avg_context_relevance', 0):.2f}")
            c3.metric("Avg Groundedness",      f"{summary.get('avg_groundedness', 0):.2f}")
            c4.metric("Avg Human Rating",
                      f"{summary['avg_human_rating']:.1f}" if summary.get("avg_human_rating") else "N/A")

            scores = api_client._get("/mlops/quality/rag", {"limit": 30})
            if scores:
                df = pd.DataFrame([{
                    "ID": s["id"],
                    "Question": s["question"][:60],
                    "Context Rel.": round(s.get("context_relevance_score") or 0, 3),
                    "Groundedness": round(s.get("groundedness_score") or 0, 3),
                    "Chunks": s.get("chunks_retrieved", 0),
                    "Human Rating": s.get("human_rating") or "",
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
            events = api_client._get("/mlops/drift/events", {"limit": 50, "acknowledged": "false"})
            if events:
                severity_color = {
                    "critical": "background-color: #f8d7da",
                    "warning":  "background-color: #fff3cd",
                    "info":     "background-color: #d1ecf1",
                }
                df = pd.DataFrame([{
                    "ID": e["id"],
                    "Type": e["drift_type"].replace("_", " ").title(),
                    "Plan": e.get("plan_id", ""),
                    "Severity": e["severity"],
                    "Description": e["description"][:80],
                    "Detected": str(e["detected_at"])[:19],
                } for e in events])
                st.dataframe(
                    df.style.map(lambda v: severity_color.get(v, ""), subset=["Severity"]),
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
                    return {
                        "production": "background-color: #d4edda",
                        "staging":    "background-color: #fff3cd",
                        "draft":      "background-color: #e2e3e5",
                        "archived":   "background-color: #f8d7da",
                    }.get(val, "")

                st.dataframe(
                    df.style.map(status_color, subset=["Status"]),
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
            c1.metric("Total Entries",  stats.get("total_entries", 0))
            c2.metric("Active",         stats.get("active_entries", 0))
            c3.metric("Invalidated",    stats.get("invalidated_entries", 0))
            c4.metric("Total Hits",     stats.get("total_cache_hits", 0))

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

    # ── Analyst Corrections ───────────────────────────────────────────────────
    elif mlops_tab == "Analyst Corrections":
        st.subheader("Analyst Corrections")
        st.caption("Review AI extraction errors flagged by analysts and apply fixes to the database.")
        try:
            show_applied = st.checkbox("Show applied corrections too", value=False)
            params = {"limit": 50}
            if not show_applied:
                params["applied"] = "false"
            corrections = api_client._get("/mlops/corrections", params)
            if corrections:
                st.caption(f"**{len(corrections)} correction(s)**")
                for c in corrections:
                    applied = c.get("applied", False)
                    with st.container(border=True):
                        col_l, col_r = st.columns([4, 1])
                        with col_l:
                            st.markdown(
                                f"**Field:** `{c['field_name']}`  |  "
                                f"**Policy ID:** {c['coverage_policy_id']}"
                            )
                            st.markdown(
                                f"~~{c.get('original_value', '—')}~~ &nbsp;→&nbsp; "
                                f"**{c['corrected_value']}**"
                            )
                            if c.get("analyst_note"):
                                st.caption(f"Note: {c['analyst_note']}")
                            st.caption(f"Submitted: {str(c.get('created_at', ''))[:10]}")
                        with col_r:
                            if applied:
                                st.success("Applied")
                            else:
                                if st.button("Apply", key=f"apply_{c['id']}", type="primary"):
                                    try:
                                        api_client._post(f"/mlops/corrections/{c['id']}/apply")
                                        st.success("Applied!")
                                        st.rerun()
                                    except Exception as e:
                                        st.error(str(e))
            else:
                st.success("No pending corrections.")
        except Exception as e:
            st.error(f"Could not load corrections: {e}")
