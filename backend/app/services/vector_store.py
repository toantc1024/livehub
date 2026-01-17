"""
Vector Store Service using Qdrant.

Handles face embedding storage and similarity search.
"""

import logging
from typing import List, Optional, AsyncGenerator
from uuid import uuid4

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    IsNullCondition,
    PayloadSchemaType,
)

from app.config import settings
from app.schemas.face import FaceSearchResult, BoundingBox

logger = logging.getLogger(__name__)


class VectorStoreService:
    """
    Qdrant vector store for face embeddings.
    
    Collections:
    - faces: All detected face embeddings
    - user_references: User reference embeddings for matching
    """
    
    def __init__(self):
        self.client: Optional[AsyncQdrantClient] = None
        self.collection = settings.QDRANT_COLLECTION
        self.user_collection = settings.QDRANT_USER_COLLECTION
    
    async def init(self):
        """Initialize Qdrant client and collections."""
        self.client = AsyncQdrantClient(url=settings.QDRANT_URL)
        
        # Create faces collection
        await self._ensure_collection(
            self.collection,
            vector_size=512,
            payload_schema={
                "face_id": PayloadSchemaType.KEYWORD,
                "image_id": PayloadSchemaType.KEYWORD,
                "user_id": PayloadSchemaType.KEYWORD,
            }
        )
        
        # Create user references collection
        await self._ensure_collection(
            self.user_collection,
            vector_size=512,
            payload_schema={
                "user_id": PayloadSchemaType.KEYWORD,
            }
        )
        
        logger.info("Qdrant collections initialized")
    
    async def _ensure_collection(
        self,
        name: str,
        vector_size: int,
        payload_schema: dict
    ):
        """Create collection if not exists."""
        collections = await self.client.get_collections()
        exists = any(c.name == name for c in collections.collections)
        
        if not exists:
            await self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=vector_size,
                    distance=Distance.COSINE,
                ),
            )
            
            # Create payload indexes
            for field, schema_type in payload_schema.items():
                await self.client.create_payload_index(
                    collection_name=name,
                    field_name=field,
                    field_schema=schema_type,
                )
            
            logger.info(f"Created collection: {name}")
    
    async def upsert_face(
        self,
        face_id: str,
        image_id: str,
        embedding: List[float],
        user_id: Optional[str] = None,
    ) -> str:
        """
        Upsert face embedding to Qdrant.
        
        Returns:
            Qdrant point ID
        """
        point_id = str(uuid4())
        
        await self.client.upsert(
            collection_name=self.collection,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "face_id": face_id,
                        "image_id": image_id,
                        "user_id": user_id,
                    },
                )
            ],
        )
        
        return point_id
    
    async def upsert_user_reference(
        self,
        user_id: str,
        embedding: List[float],
    ) -> str:
        """
        Upsert user reference embedding.
        
        Returns:
            Qdrant point ID
        """
        point_id = str(uuid4())
        
        await self.client.upsert(
            collection_name=self.user_collection,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={"user_id": user_id},
                )
            ],
        )
        
        return point_id
    
    async def search_similar(
        self,
        embedding: List[float],
        threshold: float = 0.6,
        limit: int = 10,
    ) -> List[FaceSearchResult]:
        """
        Search for similar faces.
        
        Args:
            embedding: Query embedding (512-d)
            threshold: Minimum similarity score
            limit: Max results
            
        Returns:
            List of matching faces
        """
        results = await self.client.query_points(
            collection_name=self.collection,
            query=embedding,
            limit=limit,
            score_threshold=threshold,
        )
        
        return [
            FaceSearchResult(
                face_id=hit.payload["face_id"],
                image_id=hit.payload["image_id"],
                user_id=hit.payload.get("user_id"),
                similarity=hit.score,
                bbox=BoundingBox(x=0, y=0, width=0, height=0),  # Retrieved from DB
            )
            for hit in results.points
        ]
    
    async def search_user_references(
        self,
        embedding: List[float],
        threshold: float = 0.6,
        limit: int = 5,
    ) -> List[tuple[str, float]]:
        """
        Search user reference embeddings.
        
        Returns:
            List of (user_id, similarity) tuples
        """
        results = await self.client.query_points(
            collection_name=self.user_collection,
            query=embedding,
            limit=limit,
            score_threshold=threshold,
        )
        
        return [
            (hit.payload["user_id"], hit.score)
            for hit in results.points
        ]
    
    async def scroll_unassigned_faces(
        self,
        batch_size: int = 100,
    ) -> AsyncGenerator[tuple[str, List[float]], None]:
        """
        Scroll through all faces without assigned user.
        
        Yields:
            (point_id, embedding) tuples
        """
        offset = None
        
        while True:
            result = await self.client.scroll(
                collection_name=self.collection,
                scroll_filter=Filter(
                    must=[
                        IsNullCondition(
                            is_null=FieldCondition(key="user_id", match=MatchValue(value=None))
                        )
                    ]
                ),
                limit=batch_size,
                offset=offset,
                with_vectors=True,
            )
            
            points, offset = result
            
            for point in points:
                yield point.id, point.vector
            
            if offset is None:
                break
    
    async def update_face_user(
        self,
        point_id: str,
        user_id: Optional[str],
    ):
        """Update face's assigned user. Pass None to unassign."""
        await self.client.set_payload(
            collection_name=self.collection,
            points=[point_id],
            payload={"user_id": user_id},
        )
    
    async def delete_face(self, point_id: str):
        """Delete a face embedding from Qdrant."""
        await self.client.delete(
            collection_name=self.collection,
            points_selector=[point_id],
        )
    
    async def delete_faces_by_image(self, image_id: str):
        """Delete all face embeddings for an image from Qdrant."""
        await self.client.delete(
            collection_name=self.collection,
            points_selector=Filter(
                must=[
                    FieldCondition(key="image_id", match=MatchValue(value=image_id))
                ]
            ),
        )
    
    async def check_user_has_reference(self, user_id: str) -> bool:
        """Check if user has a registered face reference."""
        result = await self.client.scroll(
            collection_name=self.user_collection,
            scroll_filter=Filter(
                must=[
                    FieldCondition(key="user_id", match=MatchValue(value=user_id))
                ]
            ),
            limit=1,
        )
        
        points, _ = result
        return len(points) > 0
    
    async def close(self):
        """Close client connection."""
        if self.client:
            await self.client.close()


# Global service instance
vector_store_service = VectorStoreService()
