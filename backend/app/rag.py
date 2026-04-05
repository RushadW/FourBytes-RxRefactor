"""RAG — ChromaDB vector store, chunking, retrieval, and Claude-powered answers."""
from __future__ import annotations

import logging
import re
import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings

log = logging.getLogger(__name__)

_client: chromadb.ClientAPI | None = None
_collection: chromadb.Collection | None = None

COLLECTION_NAME = "policy_chunks"


def get_chroma_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        _client = chromadb.Client(ChromaSettings(
            persist_directory=settings.chroma_path,
            anonymized_telemetry=False,
            is_persistent=True,
        ))
    return _client


def get_collection() -> chromadb.Collection:
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ---------- Chunking ----------

def chunk_policy_text(
    text: str,
    policy_id: str,
    drug_id: str,
    payer_id: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """Split policy text into overlapping chunks with metadata."""
    # First try to split by sections
    section_pattern = re.compile(
        r"\n(?=[A-Z][A-Z\s]{3,}(?:\n|$))", re.MULTILINE
    )
    sections = section_pattern.split(text)

    chunks: list[dict] = []
    for i, section in enumerate(sections):
        section = section.strip()
        if not section or len(section) < 20:
            continue

        # If section is larger than chunk_size, split further
        if len(section) > chunk_size:
            words = section.split()
            current: list[str] = []
            current_len = 0
            sub_idx = 0
            for word in words:
                current.append(word)
                current_len += len(word) + 1
                if current_len >= chunk_size:
                    chunk_text = " ".join(current)
                    chunks.append({
                        "id": f"{policy_id}_s{i}_c{sub_idx}",
                        "text": chunk_text,
                        "metadata": {
                            "policy_id": policy_id,
                            "drug_id": drug_id,
                            "payer_id": payer_id,
                            "section_idx": i,
                            "chunk_idx": sub_idx,
                        },
                    })
                    # Keep overlap
                    overlap_words = current[-overlap // 5:] if overlap > 0 else []
                    current = list(overlap_words)
                    current_len = sum(len(w) + 1 for w in current)
                    sub_idx += 1

            if current:
                chunks.append({
                    "id": f"{policy_id}_s{i}_c{sub_idx}",
                    "text": " ".join(current),
                    "metadata": {
                        "policy_id": policy_id,
                        "drug_id": drug_id,
                        "payer_id": payer_id,
                        "section_idx": i,
                        "chunk_idx": sub_idx,
                    },
                })
        else:
            chunks.append({
                "id": f"{policy_id}_s{i}_c0",
                "text": section,
                "metadata": {
                    "policy_id": policy_id,
                    "drug_id": drug_id,
                    "payer_id": payer_id,
                    "section_idx": i,
                    "chunk_idx": 0,
                },
            })

    return chunks


# ---------- Indexing ----------

def index_policy(policy_id: str, drug_id: str, payer_id: str, text: str):
    """Chunk and index a policy's text into ChromaDB."""
    collection = get_collection()
    chunks = chunk_policy_text(text, policy_id, drug_id, payer_id)
    if not chunks:
        return

    # Remove old chunks for this policy
    try:
        existing = collection.get(where={"policy_id": policy_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])
    except Exception:
        pass

    collection.add(
        ids=[c["id"] for c in chunks],
        documents=[c["text"] for c in chunks],
        metadatas=[c["metadata"] for c in chunks],
    )


# ---------- Search ----------

def search(
    query: str,
    n_results: int = 5,
    payer_ids: list[str] | None = None,
    drug_ids: list[str] | None = None,
) -> list[dict]:
    """Search policy chunks by natural language query."""
    collection = get_collection()

    where_filter = None
    conditions: list[dict] = []
    if payer_ids:
        conditions.append({"payer_id": {"$in": payer_ids}})
    if drug_ids:
        conditions.append({"drug_id": {"$in": drug_ids}})

    if len(conditions) > 1:
        where_filter = {"$and": conditions}
    elif len(conditions) == 1:
        where_filter = conditions[0]

    try:
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter,
        )
    except Exception:
        # If collection is empty or filter fails, return empty
        return []

    hits: list[dict] = []
    if results and results["documents"]:
        for i, doc_text in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else 0
            hits.append({
                "text": doc_text,
                "metadata": meta,
                "score": round(1 - distance, 4),  # cosine similarity
            })
    return hits


# ---------- Answer generation (Claude-powered) ----------

SYSTEM_PROMPT = """You are Anton Rx, an AI-powered Medical Benefit Drug Policy analyst.
You help healthcare professionals understand payer coverage policies for specialty drugs.

RULES:
- Answer based ONLY on the provided policy data and document excerpts. Do not invent information.
- Be concise but comprehensive. Use bullet points for lists.
- Use **bold** for drug names, payer names, and key terms.
- If comparing across payers, organize by payer with clear headings.
- If the data is insufficient, say so clearly rather than guessing.
- Include specific clinical criteria, diagnoses, and requirements when available.
- Mention effective dates and policy titles when relevant.
- Keep responses under 400 words unless the question requires more detail."""


def _build_context(chunks: list[dict], policies: list[dict]) -> str:
    """Build context string from structured data and vector chunks."""
    parts: list[str] = []

    # Structured policy data
    if policies:
        parts.append("## Structured Policy Data\n")
        for p in policies:
            name = p.get("drug_name", "Unknown Drug")
            payer = p.get("payer_name", "Unknown Payer")
            covered = "Yes" if p.get("covered") else "No"
            pa = "Yes" if p.get("prior_auth") else "No"
            st = "Yes" if p.get("step_therapy") else "No"
            indications = ", ".join(p.get("covered_indications", [])[:6]) or "Not specified"
            parts.append(
                f"### {name} — {payer}\n"
                f"- Covered: {covered}\n"
                f"- Access Status: {p.get('access_status', 'N/A')}\n"
                f"- Prior Authorization: {pa}"
                f"{' — ' + p['prior_auth_details'] if p.get('prior_auth_details') else ''}\n"
                f"- Step Therapy: {st}"
                f"{' — ' + p['step_therapy_details'] if p.get('step_therapy_details') else ''}\n"
                f"- Covered Indications: {indications}\n"
                f"- Site of Care: {', '.join(p.get('site_of_care', [])) or 'N/A'}\n"
                f"- Dosing Limits: {p.get('dosing_limits') or 'N/A'}\n"
            )

    # Vector-retrieved document excerpts
    if chunks:
        parts.append("\n## Relevant Policy Document Excerpts\n")
        for i, c in enumerate(chunks[:5], 1):
            meta = c.get("metadata", {})
            source = f"{meta.get('payer_id', '?')}/{meta.get('drug_id', '?')}"
            score = c.get("score", 0)
            parts.append(
                f"[Excerpt {i} — {source}, relevance: {score:.2f}]\n"
                f"{c['text'].strip()}\n"
            )

    return "\n".join(parts)


def generate_answer(question: str, chunks: list[dict], policies: list[dict]) -> str:
    """Generate a natural-language answer using Claude with RAG context."""

    # If no API key, fall back to template-based answer
    if not settings.anthropic_api_key:
        return _template_answer(question, chunks, policies)

    context = _build_context(chunks, policies)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n\n"
                        f"--- POLICY CONTEXT ---\n{context}\n"
                        f"--- END CONTEXT ---\n\n"
                        f"Answer the question based on the policy context above."
                    ),
                }
            ],
        )

        return message.content[0].text

    except Exception as e:
        log.error("Claude API error: %s", e)
        # Fall back to template answer
        return _template_answer(question, chunks, policies)


# ---------- Template fallback (no API key) ----------

def _template_answer(question: str, chunks: list[dict], policies: list[dict]) -> str:
    """Simple template-based answer when Claude is unavailable."""
    q = question.lower().strip()

    for p in policies:
        payer_match = p.get("payer_name", "").lower() in q or p.get("payer_id", "").lower() in q
        drug_match = p.get("drug_name", "").lower() in q
        if payer_match and drug_match:
            drug = p.get("drug_name", "this drug")
            payer = p.get("payer_name", "this payer")
            parts = [f"**{payer}** {'covers' if p.get('covered') else 'does not cover'} **{drug}**."]
            if p.get("covered"):
                if p.get("access_status"):
                    parts.append(f"Access: {p['access_status']}.")
                parts.append(f"Prior auth: {'yes' if p.get('prior_auth') else 'no'}.")
                parts.append(f"Step therapy: {'yes' if p.get('step_therapy') else 'no'}.")
                if p.get("covered_indications"):
                    parts.append(f"Indications: {', '.join(p['covered_indications'][:5])}.")
            return " ".join(parts)

    if chunks:
        top_texts = [c["text"].strip() for c in chunks[:3] if len(c["text"].strip()) > 50]
        if top_texts:
            combined = "\n\n".join(top_texts)
            if len(combined) > 1200:
                combined = combined[:1200] + "..."
            return f"From the policy documents:\n\n{combined}"

    return "I couldn't find specific information for that question. Try asking about coverage, step therapy, or prior authorization for a specific drug and payer."
