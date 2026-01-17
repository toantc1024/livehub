"""
Background Worker - Runs as a separate process.

Usage:
    python worker.py

This worker processes:
1. IMAGE_PROCESSING - Detect faces in uploaded images
2. FACE_REGISTRATION - Register user face and run backfill
3. USER_BACKFILL - Match existing faces to a user

Completely independent from FastAPI - no shared resources.
"""

import asyncio
import logging
import sys
import signal
from datetime import datetime
from typing import Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("worker")

# Reduce noise from other loggers
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Flag for graceful shutdown
_shutdown = False


def handle_shutdown(signum, frame):
    global _shutdown
    logger.info("Received shutdown signal, finishing current task...")
    _shutdown = True


async def process_image(
    image,
    db,
    qdrant,
    session_maker,
    storage_service,
    face_detection_service,
    settings,
):
    """Process a single image - detect faces and match users."""
    from sqlalchemy import select, update
    from qdrant_client.models import PointStruct
    from uuid import uuid4
    from app.models.image import Image
    from app.models.face import Face
    from app.schemas import ImageStatus
    
    logger.info(f"Processing image: {image.id} ({image.filename})")
    
    try:
        # Download image
        image_bytes = storage_service.download_file(image.storagePath)
        logger.info(f"  Downloaded {len(image_bytes)} bytes")
        
        # Detect faces
        faces = face_detection_service.detect_from_bytes(image_bytes)
        logger.info(f"  Detected {len(faces)} faces")
        
        # Store faces
        face_records = []
        for face_data in faces:
            face_id = str(uuid4())
            qdrant_point_id = str(uuid4())
            
            # Store in Qdrant
            await qdrant.upsert(
                collection_name=settings.QDRANT_COLLECTION,
                points=[
                    PointStruct(
                        id=qdrant_point_id,
                        vector=face_data.embedding,
                        payload={
                            "face_id": face_id,
                            "image_id": image.id,
                            "user_id": None,
                        },
                    )
                ],
            )
            
            # Try to match user
            matched_user_id, similarity_score = await match_face_to_user(
                qdrant, face_data.embedding, qdrant_point_id, settings
            )
            
            face_records.append(Face(
                id=face_id,
                imageId=image.id,
                userId=matched_user_id,
                similarity=similarity_score,  # Store similarity score
                qdrantId=qdrant_point_id,
                x=face_data.bbox.x,
                y=face_data.bbox.y,
                width=face_data.bbox.width,
                height=face_data.bbox.height,
                confidence=face_data.confidence,
            ))
        
        # Update database
        async with session_maker() as db:
            await db.execute(
                update(Image)
                .where(Image.id == image.id)
                .values(status=ImageStatus.READY)
            )
            
            for face in face_records:
                db.add(face)
            
            await db.commit()
        
        logger.info(f"  ✓ Image {image.id} READY ({len(face_records)} faces)")
        return True
        
    except Exception as e:
        logger.error(f"  ✗ Failed to process {image.id}: {e}", exc_info=True)
        
        # Mark as ERROR
        async with session_maker() as db:
            from app.schemas import ImageStatus
            await db.execute(
                update(Image)
                .where(Image.id == image.id)
                .values(status=ImageStatus.ERROR)
            )
            await db.commit()
        
        return False


async def match_face_to_user(qdrant, embedding, qdrant_point_id, settings) -> tuple[Optional[str], Optional[float]]:
    """
    Match a face embedding to registered users.
    
    Returns:
        tuple of (user_id, similarity_score) or (None, None) if no match
    """
    try:
        # Search user references
        all_results = await qdrant.query_points(
            collection_name=settings.QDRANT_USER_COLLECTION,
            query=embedding,
            limit=3,
            score_threshold=0.0,  # Get all to see scores
        )
        
        if all_results.points:
            best = all_results.points[0]
            logger.info(f"    Best match: user={best.payload.get('user_id')} score={best.score:.3f} (threshold={settings.SIMILARITY_THRESHOLD})")
            
            if best.score >= settings.SIMILARITY_THRESHOLD:
                matched_user_id = best.payload.get("user_id")
                similarity_score = best.score
                logger.info(f"    ✓ Face matched user {matched_user_id}")
                
                # Update Qdrant payload
                await qdrant.set_payload(
                    collection_name=settings.QDRANT_COLLECTION,
                    payload={"user_id": matched_user_id},
                    points=[qdrant_point_id],
                )
                return matched_user_id, similarity_score
            else:
                logger.info(f"    ✗ Score {best.score:.3f} below threshold {settings.SIMILARITY_THRESHOLD}")
        else:
            logger.debug(f"    No user references to match against")
            
    except Exception as e:
        logger.warning(f"    Face matching failed: {e}")
    
    return None, None


async def process_face_registration(task, session_maker, qdrant, settings):
    """
    Process face registration task.
    
    1. Store user's face embedding in Qdrant user_references
    2. Run backfill to match existing unassigned faces
    """
    from qdrant_client.models import PointStruct
    from sqlalchemy import update
    from uuid import uuid4
    from app.models.face import Face
    from app.models.task import BackgroundTask, TaskStatus
    
    user_id = task.payload["user_id"]
    embedding = task.payload["embedding"]
    
    logger.info(f"Processing face registration for user {user_id}")
    
    try:
        # Ensure user_references collection exists
        try:
            await qdrant.get_collection(settings.QDRANT_USER_COLLECTION)
        except Exception:
            from qdrant_client.models import VectorParams, Distance
            await qdrant.create_collection(
                collection_name=settings.QDRANT_USER_COLLECTION,
                vectors_config=VectorParams(size=512, distance=Distance.COSINE),
            )
            logger.info(f"  Created {settings.QDRANT_USER_COLLECTION} collection")
        
        # Store user reference embedding
        qdrant_id = str(uuid4())
        await qdrant.upsert(
            collection_name=settings.QDRANT_USER_COLLECTION,
            points=[
                PointStruct(
                    id=qdrant_id,
                    vector=embedding,
                    payload={"user_id": user_id},
                )
            ],
        )
        logger.info(f"  Stored user reference: {qdrant_id}")
        
        # Now run backfill - match all unassigned faces to this user
        matched_count = await run_backfill_for_user(
            user_id, embedding, session_maker, qdrant, settings
        )
        
        # Mark task completed
        async with session_maker() as db:
            await db.execute(
                update(BackgroundTask)
                .where(BackgroundTask.id == task.id)
                .values(
                    status=TaskStatus.COMPLETED,
                    completedAt=datetime.utcnow(),
                )
            )
            await db.commit()
        
        logger.info(f"  ✓ Face registration complete, matched {matched_count} faces")
        return True
        
    except Exception as e:
        logger.error(f"  ✗ Face registration failed: {e}", exc_info=True)
        
        # Mark task failed
        async with session_maker() as db:
            await db.execute(
                update(BackgroundTask)
                .where(BackgroundTask.id == task.id)
                .values(
                    status=TaskStatus.FAILED,
                    completedAt=datetime.utcnow(),
                    error=str(e),
                )
            )
            await db.commit()
        
        return False


async def run_backfill_for_user(user_id, user_embedding, session_maker, qdrant, settings) -> int:
    """
    Match all unassigned faces to a user.
    
    Uses Qdrant's query_points for accurate similarity calculation.
    Returns the number of faces matched.
    """
    from sqlalchemy import update
    from app.models.face import Face
    
    matched_count = 0
    offset = None
    batch_size = 100
    
    logger.info(f"  Running backfill for user {user_id}")
    
    while True:
        # Scroll through all faces in Qdrant
        result = await qdrant.scroll(
            collection_name=settings.QDRANT_COLLECTION,
            limit=batch_size,
            offset=offset,
            with_vectors=True,
            with_payload=True,
        )
        
        points, next_offset = result
        
        if not points:
            break
        
        for point in points:
            # Skip if already assigned
            if point.payload.get("user_id") is not None:
                continue
            
            # Use Qdrant to calculate similarity to user references
            search_result = await qdrant.query_points(
                collection_name=settings.QDRANT_USER_COLLECTION,
                query=point.vector,
                limit=5,
                score_threshold=0.0,
            )
            
            # Check if this user matches above threshold
            for hit in search_result.points:
                if hit.payload.get("user_id") == user_id and hit.score >= settings.SIMILARITY_THRESHOLD:
                    face_id = point.payload.get("face_id")
                    similarity_score = hit.score
                    logger.info(f"    Backfill: face {face_id} -> user {user_id} (sim: {similarity_score:.3f})")
                    
                    # Update Qdrant
                    await qdrant.set_payload(
                        collection_name=settings.QDRANT_COLLECTION,
                        payload={"user_id": user_id},
                        points=[point.id],
                    )
                    
                    # Update PostgreSQL - include similarity score
                    async with session_maker() as db:
                        await db.execute(
                            update(Face)
                            .where(Face.qdrantId == str(point.id))
                            .values(userId=user_id, similarity=similarity_score)
                        )
                        await db.commit()
                    
                    matched_count += 1
                    break  # Face assigned, move to next
        
        if next_offset is None:
            break
        offset = next_offset
    
    logger.info(f"  Backfill complete: matched {matched_count} faces")
    return matched_count


async def process_user_backfill(task, session_maker, qdrant, settings):
    """
    Process standalone backfill task.
    
    This is for when we need to re-run backfill without re-registering face.
    """
    from sqlalchemy import update, select
    from app.models.task import BackgroundTask, TaskStatus
    
    user_id = task.payload["user_id"]
    user_qdrant_id = task.payload.get("user_qdrant_id")
    
    logger.info(f"Processing backfill task for user {user_id}")
    
    try:
        # Get user's embedding from Qdrant
        points = await qdrant.retrieve(
            collection_name=settings.QDRANT_USER_COLLECTION,
            ids=[user_qdrant_id] if user_qdrant_id else [],
            with_vectors=True,
        )
        
        if not points:
            # Search for user's embedding by payload
            result = await qdrant.scroll(
                collection_name=settings.QDRANT_USER_COLLECTION,
                limit=1,
                with_vectors=True,
                scroll_filter={
                    "must": [{"key": "user_id", "match": {"value": user_id}}]
                },
            )
            points = result[0]
        
        if not points:
            raise ValueError(f"No face reference found for user {user_id}")
        
        user_embedding = points[0].vector
        
        # Run backfill
        matched_count = await run_backfill_for_user(
            user_id, user_embedding, session_maker, qdrant, settings
        )
        
        # Mark task completed
        async with session_maker() as db:
            await db.execute(
                update(BackgroundTask)
                .where(BackgroundTask.id == task.id)
                .values(
                    status=TaskStatus.COMPLETED,
                    completedAt=datetime.utcnow(),
                )
            )
            await db.commit()
        
        logger.info(f"  ✓ Backfill complete, matched {matched_count} faces")
        return True
        
    except Exception as e:
        logger.error(f"  ✗ Backfill failed: {e}", exc_info=True)
        
        # Mark task failed
        async with session_maker() as db:
            await db.execute(
                update(BackgroundTask)
                .where(BackgroundTask.id == task.id)
                .values(
                    status=TaskStatus.FAILED,
                    completedAt=datetime.utcnow(),
                    error=str(e),
                )
            )
            await db.commit()
        
        return False


async def main():
    """Main worker loop."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import select, update
    from qdrant_client import AsyncQdrantClient
    
    from app.config import settings
    from app.models.image import Image
    from app.models.task import BackgroundTask, TaskType, TaskStatus
    from app.schemas import ImageStatus
    from app.services.storage import storage_service
    from app.services.face_detection import face_detection_service
    
    logger.info("=" * 50)
    logger.info("WORKER STARTING")
    logger.info("=" * 50)
    
    # Create database connection
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(
        db_url,
        echo=False,
        pool_size=2,
        max_overflow=3,
    )
    
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # Create Qdrant client
    qdrant = AsyncQdrantClient(url=settings.QDRANT_URL)
    
    # Initialize storage
    storage_service.init()
    
    logger.info(f"Connected to database: {settings.DATABASE_URL[:50]}...")
    logger.info(f"Connected to Qdrant: {settings.QDRANT_URL}")
    logger.info(f"Similarity threshold: {settings.SIMILARITY_THRESHOLD}")
    logger.info("Worker ready, polling for tasks...")
    
    image_count = 0
    task_count = 0
    
    while not _shutdown:
        try:
            work_done = False
            
            # Priority 1: Check for pending background tasks (face registration, backfill)
            async with session_maker() as db:
                result = await db.execute(
                    select(BackgroundTask)
                    .where(BackgroundTask.status == TaskStatus.PENDING)
                    .order_by(
                        BackgroundTask.priority.desc(),  # high > normal > low
                        BackgroundTask.createdAt.asc()
                    )
                    .limit(1)
                )
                task = result.scalar_one_or_none()
            
            if task:
                # Mark as processing
                async with session_maker() as db:
                    await db.execute(
                        update(BackgroundTask)
                        .where(BackgroundTask.id == task.id)
                        .values(
                            status=TaskStatus.PROCESSING,
                            startedAt=datetime.utcnow(),
                        )
                    )
                    await db.commit()
                
                # Process based on task type
                if task.taskType == TaskType.FACE_REGISTRATION:
                    await process_face_registration(task, session_maker, qdrant, settings)
                elif task.taskType == TaskType.USER_BACKFILL:
                    await process_user_backfill(task, session_maker, qdrant, settings)
                
                task_count += 1
                work_done = True
            
            # Priority 2: Check for PROCESSING images
            if not work_done:
                async with session_maker() as db:
                    result = await db.execute(
                        select(Image)
                        .where(Image.status == ImageStatus.PROCESSING)
                        .order_by(Image.createdAt.asc())
                        .limit(1)
                    )
                    image = result.scalar_one_or_none()
                
                if image:
                    success = await process_image(
                        image, db, qdrant, session_maker,
                        storage_service, face_detection_service, settings
                    )
                    if success:
                        image_count += 1
                    work_done = True
            
            # No work? Sleep and poll again
            if not work_done:
                await asyncio.sleep(2)
                
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            await asyncio.sleep(5)
    
    # Cleanup
    logger.info("Shutting down worker...")
    logger.info(f"Stats: {image_count} images, {task_count} tasks processed")
    await engine.dispose()
    await qdrant.close()
    logger.info("Worker stopped")


if __name__ == "__main__":
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
