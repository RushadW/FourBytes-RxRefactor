from typing import List, Dict, Any, Optional
import chromadb
from chromadb.utils import embedding_functions

from backend.config import CHROMA_PERSIST_DIR

COLLECTION_NAME = "policy_chunks"

_client: Optional[chromadb.PersistentClient] = None
_collection = None


def _get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
    return _client


def _get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        ef = embedding_functions.DefaultEmbeddingFunction()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def add_chunks(chunks: List[Dict[str, Any]], document_id: int, plan_id: int,
               plan_name: str, quarter: str = None):
    """Embed and store text chunks in ChromaDB."""
    collection = _get_collection()

    ids = []
    documents = []
    metadatas = []

    for chunk in chunks:
        chroma_id = f"doc{document_id}_chunk{chunk['chunk_index']}"
        ids.append(chroma_id)
        documents.append(chunk["text"])
        metadatas.append({
            "document_id": str(document_id),
            "plan_id": str(plan_id),
            "plan_name": plan_name,
            "quarter": quarter or "",
            "page_number": str(chunk.get("page_num", 1)),
            "chunk_index": str(chunk["chunk_index"]),
        })

    if ids:
        collection.add(ids=ids, documents=documents, metadatas=metadatas)

    return [f"doc{document_id}_chunk{c['chunk_index']}" for c in chunks]


def delete_chunks_for_document(document_id: int):
    """Remove all chunks for a given document from ChromaDB."""
    collection = _get_collection()
    try:
        collection.delete(where={"document_id": str(document_id)})
    except Exception:
        pass  # Collection may be empty


def similarity_search(query: str, n_results: int = 5,
                      plan_ids: List[int] = None) -> List[Dict[str, Any]]:
    """Return top-N most relevant chunks. Optionally filter by plan_ids."""
    collection = _get_collection()

    where = None
    if plan_ids and len(plan_ids) == 1:
        where = {"plan_id": str(plan_ids[0])}
    elif plan_ids and len(plan_ids) > 1:
        where = {"plan_id": {"$in": [str(p) for p in plan_ids]}}

    try:
        kwargs = {"query_texts": [query], "n_results": min(n_results, collection.count() or 1)}
        if where:
            kwargs["where"] = where
        results = collection.query(**kwargs)
    except Exception:
        return []

    hits = []
    if results and results["ids"]:
        for i, chroma_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            hits.append({
                "chroma_id": chroma_id,
                "text": results["documents"][0][i],
                "plan_name": meta.get("plan_name", ""),
                "plan_id": int(meta.get("plan_id", 0)),
                "document_id": int(meta.get("document_id", 0)),
                "page_number": int(meta.get("page_number", 1)),
                "quarter": meta.get("quarter", ""),
                "distance": results["distances"][0][i] if results.get("distances") else None,
            })
    return hits


def collection_count() -> int:
    try:
        return _get_collection().count()
    except Exception:
        return 0
