"""
Backfill Service - Match new user faces against existing faces.
"""

import logging
from typing import List, Tuple

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.vector_store import vector_store_service
from app.models.face import Face

logger = logging.getLogger(__name__)


async def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    import numpy as np
    
    a = np.array(vec1)
    b = np.array(vec2)
    
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


async def backfill_user_faces(
    user_id: str,
    user_embedding: List[float],
    threshold: float = None,
) -> List[Tuple[str, float]]:
    """
    Search new user's face against ALL unknown faces.
    
    This is triggered when a user registers their face.
    
    Args:
        user_id: The user's ID
        user_embedding: The user's reference face embedding
        threshold: Similarity threshold (default from settings)
        
    Returns:
        List of (qdrant_point_id, similarity) for matched faces
    """
    if threshold is None:
        threshold = settings.SIMILARITY_THRESHOLD
    
    matched_faces = []
    
    # Scroll through all unassigned faces
    async for point_id, embedding in vector_store_service.scroll_unassigned_faces():
        similarity = await cosine_similarity(user_embedding, embedding)
        
        if similarity >= threshold:
            matched_faces.append((point_id, similarity))
            
            # Update face in Qdrant
            await vector_store_service.update_face_user(point_id, user_id)
            
            logger.info(f"Auto-assigned face {point_id} to user {user_id} (similarity: {similarity:.3f})")
    
    logger.info(f"Backfill complete for user {user_id}: {len(matched_faces)} faces matched")
    
    return matched_faces


async def find_best_user_match(
    face_embedding: List[float],
    threshold: float = None,
) -> Tuple[str, float] | None:
    """
    Find best matching user for a face embedding.
    
    Args:
        face_embedding: The face's embedding
        threshold: Similarity threshold
        
    Returns:
        (user_id, similarity) or None if no match
    """
    if threshold is None:
        threshold = settings.SIMILARITY_THRESHOLD
    
    matches = await vector_store_service.search_user_references(
        embedding=face_embedding,
        threshold=threshold,
        limit=1,
    )
    
    if matches:
        return matches[0]
    
    return None
