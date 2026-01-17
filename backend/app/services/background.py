"""
Background processing service - Queue tasks to database.

The FastAPI app queues tasks to the background_tasks table.
A separate worker.py process polls and processes tasks.

This is the production-ready pattern:
- No threads, no multiprocessing complexity
- Worker is completely separate process
- Can scale workers independently
- Easy to monitor and debug
"""

import logging
from uuid import uuid4
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import BackgroundTask, TaskType, TaskStatus

logger = logging.getLogger(__name__)


async def queue_task(
    db: AsyncSession,
    task_type: TaskType,
    payload: dict,
    priority: str = "normal",
) -> str:
    """
    Queue a background task.
    
    Args:
        db: Database session
        task_type: Type of task
        payload: Task-specific data
        priority: "high", "normal", or "low"
    
    Returns:
        Task ID
    """
    task_id = str(uuid4())
    
    task = BackgroundTask(
        id=task_id,
        taskType=task_type,
        status=TaskStatus.PENDING,
        payload=payload,
        priority=priority,
    )
    
    db.add(task)
    await db.commit()
    
    logger.info(f"[BG] Queued {task_type.value} task {task_id}")
    return task_id


async def queue_face_registration(
    db: AsyncSession,
    user_id: str,
    embedding: List[float],
) -> str:
    """
    Queue face registration task.
    
    The worker will:
    1. Store the embedding in Qdrant user_references collection
    2. Run backfill to match existing faces to this user
    """
    return await queue_task(
        db=db,
        task_type=TaskType.FACE_REGISTRATION,
        payload={
            "user_id": user_id,
            "embedding": embedding,
        },
        priority="high",
    )


async def queue_user_backfill(
    db: AsyncSession,
    user_id: str,
    user_qdrant_id: str,
) -> str:
    """
    Queue user backfill task.
    
    The worker will search all unassigned faces and assign matching ones to this user.
    """
    return await queue_task(
        db=db,
        task_type=TaskType.USER_BACKFILL,
        payload={
            "user_id": user_id,
            "user_qdrant_id": user_qdrant_id,
        },
        priority="normal",
    )


def schedule_image_processing(image_id: str, storage_path: str, user_id: str):
    """
    Schedule image processing (legacy - images use status field).
    
    Images are saved with status=PROCESSING and the worker polls for them.
    This function just logs - no task table entry needed.
    """
    logger.info(f"[BG] Image {image_id} queued for processing (worker will pick it up)")


def schedule_user_backfill(user_id: str, qdrant_reference_id: str):
    """
    Legacy function - use queue_user_backfill instead.
    
    This is kept for compatibility but does nothing.
    The actual queueing should be done with queue_face_registration.
    """
    logger.info(f"[BG] User backfill for {user_id} - use queue_face_registration instead")
