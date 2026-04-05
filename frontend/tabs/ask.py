import streamlit as st
import pandas as pd
from frontend.utils import api_client
from frontend.utils.styles import coverage_badge, benefit_badge, dc_badge, tier_badge


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
            label_visibility="collapsed",
        )
    with col2:
        st.markdown(
            '<p style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;">'
            'Example questions</p>',
            unsafe_allow_html=True,
        )
        for ex in example_questions:
            if st.button(ex[:45] + ("…" if len(ex) > 45 else ""),
                         key=f"ex_{ex[:20]}", use_container_width=True):
                st.session_state["prefill_q"] = ex

    if "prefill_q" in st.session_state:
        question = st.session_state.pop("prefill_q")

    col_filter, col_btn = st.columns([3, 1])
    with col_filter:
        filter_plans = st.checkbox("Filter to selected plans only", value=False)
    with col_btn:
        ask_clicked = st.button("🔍 Ask", type="primary",
                                disabled=not question.strip(), use_container_width=True)

    if ask_clicked:
        with st.spinner("Searching policies…"):
            try:
                result = api_client.ask(
                    question=question,
                    plan_ids=selected_plan_ids if filter_plans and selected_plan_ids else None,
                )

                # ── Answer bubble ──────────────────────────────────────────
                tier  = result.get("routing_tier", "tier_3_rag")
                cost  = result.get("source_cost", "")
                cache = result.get("cache_hit", False)

                st.markdown(
                    f"""
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;
            padding:16px 20px;margin:12px 0;
            box-shadow:0 1px 3px rgba(0,0,0,.06);">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <div style="width:32px;height:32px;border-radius:50%;background:#1d4ed8;
                color:#fff;display:flex;align-items:center;justify-content:center;
                font-size:13px;font-weight:700;flex-shrink:0;">Rx</div>
    <span style="font-weight:600;font-size:14px;color:#0f172a;">AntonRx</span>
    {tier_badge(tier, cost, cache)}
  </div>
  <div style="font-size:14px;line-height:1.7;color:#334155;">
    {_md(result["answer"])}
  </div>
</div>""",
                    unsafe_allow_html=True,
                )

                # ── Structured hits ────────────────────────────────────────
                if result.get("structured_hits"):
                    st.markdown("#### Policy Matches")
                    rows = result["structured_hits"]
                    _render_hits_table(rows)

                # ── Sources ────────────────────────────────────────────────
                if result.get("sources"):
                    with st.expander(f"📄 Source evidence — {len(result['sources'])} chunks"):
                        for i, src in enumerate(result["sources"]):
                            st.markdown(
                                f"""
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;
            padding:10px 14px;margin-bottom:8px;">
  <div style="font-weight:600;font-size:12.5px;color:#0f172a;">
    {src['plan_name']} — {src['document_name']}
    {"· Page " + str(src['page_number']) if src.get('page_number') else ""}
  </div>
  <div style="font-style:italic;color:#64748b;font-size:12px;margin-top:4px;">
    "{src['chunk_text'][:200]}{'…' if len(src['chunk_text']) > 200 else ''}"
  </div>
</div>""",
                                unsafe_allow_html=True,
                            )

            except Exception as e:
                st.error(f"Query failed: {e}")


def _render_hits_table(rows):
    """Render structured hits as an HTML table with mockup-style badges."""
    def pa(v):  return "✓ Req" if v else "✗ No"
    def st_(v): return "✓ Req" if v else "✗ No"

    header = """
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead>
<tr style="background:#f8fafc;border-bottom:1px solid #e2e8f0;">
  <th style="text-align:left;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Plan</th>
  <th style="text-align:left;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Benefit</th>
  <th style="text-align:left;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Coverage</th>
  <th style="text-align:center;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">PA</th>
  <th style="text-align:center;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Step Tx</th>
  <th style="text-align:left;padding:10px 14px;font-size:11.5px;font-weight:600;
             text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Data</th>
</tr>
</thead><tbody>"""

    body = ""
    for r in rows:
        pa_color  = "#15803d" if r["requires_prior_auth"]  else "#94a3b8"
        st_color  = "#15803d" if r["requires_step_therapy"] else "#94a3b8"
        body += f"""
<tr style="border-bottom:1px solid #f1f5f9;">
  <td style="padding:11px 14px;font-weight:500;color:#0f172a;">{r['plan_name']}</td>
  <td style="padding:11px 14px;">{benefit_badge(r.get('benefit_side',''))}</td>
  <td style="padding:11px 14px;">{coverage_badge(r['coverage_status'])}</td>
  <td style="padding:11px 14px;text-align:center;color:{pa_color};font-weight:600;font-size:13px;">{pa(r['requires_prior_auth'])}</td>
  <td style="padding:11px 14px;text-align:center;color:{st_color};font-weight:600;font-size:13px;">{st_(r['requires_step_therapy'])}</td>
  <td style="padding:11px 14px;">{dc_badge(r.get('data_completeness','low'))}</td>
</tr>"""

    footer = "</tbody></table>"
    st.markdown(
        f'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;'
        f'overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:16px;">'
        f'{header}{body}{footer}</div>',
        unsafe_allow_html=True,
    )


def _md(text: str) -> str:
    """Minimal markdown → HTML (bold, bullets, line breaks)."""
    import re
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    lines, out, in_ul = text.split('\n'), [], False
    for line in lines:
        if re.match(r'^[-•]\s+', line):
            if not in_ul:
                out.append('<ul style="padding-left:18px;margin:6px 0;">')
                in_ul = True
            out.append(f'<li style="margin-bottom:3px;">{re.sub(r"^[-•]\s+", "", line)}</li>')
        else:
            if in_ul:
                out.append('</ul>')
                in_ul = False
            out.append(line)
    if in_ul:
        out.append('</ul>')
    return '<br>'.join(out)
