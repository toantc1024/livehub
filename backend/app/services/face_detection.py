"""
Face Detection Service using ArcFace via DeepFace.

- ArcFace (ResNet100)
- 512-dimensional embeddings
- RetinaFace detector
- CPU-safe
- Matches Prisma + Pydantic schemas exactly
"""

import logging
from typing import List, Optional

import cv2
import numpy as np
from deepface import DeepFace

from app.schemas.face import (
    FaceDetectionResult,
    BoundingBox,
)

logger = logging.getLogger(__name__)


class FaceDetectionService:
    """
    Face detection & embedding service.

    Uses:
    - Detector: RetinaFace
    - Embedder: ArcFace (512-d)
    """

    def __init__(self):
        from app.config import settings
        
        self.model_name = "Facenet"
        self.detector_backend = "retinaface"
        self.use_cuda = settings.USE_CUDA
        
        # Configure TensorFlow/backend for CPU/GPU
        if not self.use_cuda:
            import os
            # Force CPU for TensorFlow
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            # For ONNX Runtime (used by some models)
            os.environ["ORT_DEVICE"] = "CPU"
            logger.info("Face detection: Using CPU mode")
        else:
            logger.info("Face detection: Using CUDA/GPU mode")

    # ---------------------------
    # Core detection
    # ---------------------------
    def detect_faces(self, image: np.ndarray) -> List[FaceDetectionResult]:
        """
        Detect faces and generate ArcFace embeddings.

        Args:
            image: OpenCV BGR image

        Returns:
            List[FaceDetectionResult]
        """
        try:
            detections = DeepFace.extract_faces(
                img_path=image,
                detector_backend=self.detector_backend,
                enforce_detection=False,
                align=True,
            )
        except Exception:
            logger.exception("Face detection failed")
            raise

        results: List[FaceDetectionResult] = []

        for det in detections:
            region = det["facial_area"]

            x = int(region["x"])
            y = int(region["y"])
            w = int(region["w"])
            h = int(region["h"])

            confidence = float(det.get("confidence", 1.0))

            # Crop face
            face_img = image[y : y + h, x : x + w]

            if face_img.size == 0:
                continue

            # Generate ArcFace embedding (512-d)
            rep = DeepFace.represent(
                img_path=face_img,
                model_name=self.model_name,
                enforce_detection=False,
            )

            embedding = rep[0]["embedding"]

            results.append(
                FaceDetectionResult(
                    bbox=BoundingBox(
                        x=float(x),
                        y=float(y),
                        width=float(w),
                        height=float(h),
                    ),
                    confidence=confidence,
                    embedding=embedding,
                )
            )

        return results

    # ---------------------------
    # Helpers
    # ---------------------------
    def detect_from_bytes(self, image_bytes: bytes) -> List[FaceDetectionResult]:
        """
        Detect faces from raw image bytes.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Invalid image bytes")

        return self.detect_faces(image)

    def detect_from_path(self, image_path: str) -> List[FaceDetectionResult]:
        """
        Detect faces from image path.
        """
        image = cv2.imread(image_path)

        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")

        return self.detect_faces(image)

    def get_single_face_embedding(
        self, image_bytes: bytes
    ) -> Optional[List[float]]:
        """
        Extract embedding for single-face use cases (user registration).

        Returns:
            512-d embedding or None

        Raises:
            ValueError if multiple faces detected
        """
        faces = self.detect_from_bytes(image_bytes)

        if len(faces) == 0:
            return None

        if len(faces) > 1:
            raise ValueError(f"Expected 1 face, found {len(faces)}")

        return faces[0].embedding


# Singleton instance
face_detection_service = FaceDetectionService()
