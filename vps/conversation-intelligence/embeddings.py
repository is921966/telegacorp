"""
Embeddings — sentence-transformers for message vectorization → Qdrant.
Uses all-MiniLM-L6-v2 (384-dim, multilingual-friendly).
"""

import uuid
from typing import Optional
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)


class MessageEmbeddings:
    def __init__(
        self,
        qdrant_url: str = "http://localhost:6333",
        collection_name: str = "telegram_messages",
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        embedding_dim: int = 384,
    ):
        self.model = SentenceTransformer(model_name)
        self.qdrant = QdrantClient(url=qdrant_url)
        self.collection_name = collection_name
        self.embedding_dim = embedding_dim

        self._ensure_collection()

    def _ensure_collection(self) -> None:
        """Create collection if it doesn't exist."""
        collections = self.qdrant.get_collections().collections
        names = [c.name for c in collections]
        if self.collection_name not in names:
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(
                    size=self.embedding_dim,
                    distance=Distance.COSINE,
                ),
            )
            print(f"[Embeddings] Created collection: {self.collection_name}")

    def embed_message(
        self,
        text: str,
        metadata: dict,
    ) -> str:
        """
        Embed a single message and store in Qdrant.
        Returns the point ID.
        """
        if not text or len(text.strip()) < 3:
            return ""

        vector = self.model.encode(text).tolist()
        point_id = str(uuid.uuid4())

        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "text": text[:2000],  # Truncate for storage
                        "chat_id": metadata.get("chat_id", ""),
                        "sender_id": metadata.get("sender_id", ""),
                        "message_id": metadata.get("message_id", ""),
                        "date": metadata.get("date", ""),
                        "intent": metadata.get("intent", ""),
                        "confidence": metadata.get("confidence", 0.0),
                    },
                )
            ],
        )

        return point_id

    def embed_batch(
        self,
        items: list[dict],
    ) -> list[str]:
        """
        Embed a batch of messages.
        Each item: {"text": str, "metadata": dict}
        """
        texts = [item["text"] for item in items if item["text"].strip()]
        if not texts:
            return []

        vectors = self.model.encode(texts, batch_size=32).tolist()

        points = []
        point_ids = []
        for i, item in enumerate(items):
            if not item["text"].strip():
                point_ids.append("")
                continue

            point_id = str(uuid.uuid4())
            point_ids.append(point_id)

            meta = item.get("metadata", {})
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vectors[i] if i < len(vectors) else vectors[-1],
                    payload={
                        "text": item["text"][:2000],
                        "chat_id": meta.get("chat_id", ""),
                        "sender_id": meta.get("sender_id", ""),
                        "message_id": meta.get("message_id", ""),
                        "date": meta.get("date", ""),
                        "intent": meta.get("intent", ""),
                        "confidence": meta.get("confidence", 0.0),
                    },
                )
            )

        if points:
            self.qdrant.upsert(
                collection_name=self.collection_name,
                points=points,
            )

        return point_ids

    def search_similar(
        self,
        query: str,
        chat_id: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict]:
        """Search for similar messages by text query."""
        vector = self.model.encode(query).tolist()

        query_filter = None
        if chat_id:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="chat_id",
                        match=MatchValue(value=chat_id),
                    )
                ]
            )

        results = self.qdrant.search(
            collection_name=self.collection_name,
            query_vector=vector,
            query_filter=query_filter,
            limit=limit,
        )

        return [
            {
                "id": r.id,
                "score": r.score,
                "text": r.payload.get("text", "") if r.payload else "",
                "chat_id": r.payload.get("chat_id", "") if r.payload else "",
                "date": r.payload.get("date", "") if r.payload else "",
                "intent": r.payload.get("intent", "") if r.payload else "",
            }
            for r in results
        ]
