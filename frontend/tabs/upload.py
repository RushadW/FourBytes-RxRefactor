import streamlit as st
import pandas as pd
from frontend.utils import api_client


def render(plans, plan_options, selected_plan_ids):
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
            doc_id = None
            upload_resp = {}
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

            if doc_id and upload_resp.get("status") != "complete":
                with st.spinner("Processing with AI... (this may take 30-90 seconds)"):
                    try:
                        result = api_client.process_document(doc_id)
                        if result["status"] in ("complete", "low_quality"):
                            quality_note = " (low quality — check MLOps)" if result["status"] == "low_quality" else ""
                            st.success(
                                f"✅ Processing complete{quality_note}\n\n"
                                f"- **{result['drugs_extracted']}** drugs extracted\n"
                                f"- **{result.get('policies_created', 0)}** new coverage policies\n"
                                f"- **{result.get('changes_detected', 0)}** policy changes detected"
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
                return {
                    "complete":    "background-color: #d4edda",
                    "low_quality": "background-color: #fff3cd",
                    "failed":      "background-color: #f8d7da",
                    "processing":  "background-color: #cfe2ff",
                    "pending":     "background-color: #e2e3e5",
                }.get(val, "")

            st.dataframe(
                df.style.map(status_color, subset=["Status"]),
                use_container_width=True,
                hide_index=True,
            )

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
