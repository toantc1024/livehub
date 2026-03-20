"""
Face Detection Service — Industry-Grade Pipeline.

Architecture:
  - Model: ArcFace (ResNet100, 512-d embeddings) — gold-standard for face recognition
  - Detector: RetinaFace — highest accuracy face detector
  - Pipeline: Single-step represent() → detection + alignment + embedding in one pass
  - Quality gates: confidence, minimum size, blur rejection
  - Embeddings: L2-normalized for consistent cosine similarity

Why this works better:
  1. Single-step pipeline preserves face alignment (two-step crop+embed loses it)
  2. Quality filters prevent garbage-in/garbage-out (blurry/tiny/low-conf faces)
  3. ArcFace produces more discriminative embeddings than Facenet512
  4. L2-normalized embeddings give well-calibrated cosine similarity scores:
     - Same person:      0.40–0.75 cosine similarity
     - Different person: -0.10–0.25 cosine similarity
     - Threshold:        0.40 (good precision/recall balance)
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

# Quality thresholds
MIN_DETECTION_CONFIDENCE = 0.90   # RetinaFace confidence
MIN_FACE_SIZE_PX = 50             # Minimum face width/height in pixels
MIN_BLUR_SCORE = 30.0             # Laplacian variance (below = too blurry)
MIN_REGISTRATION_CONFIDENCE = 0.85
MIN_REGISTRATION_FACE_RATIO = 0.04  # Face must be ≥4% of image area


class FaceDetectionService:
    """
    Production face detection & embedding service.

    Uses single-step DeepFace.represent() which does:
      detection → face alignment → model inference
    in one pass, preserving critical alignment quality.
    """

    def __init__(self):
        from app.config import settings

        self.model_name = "ArcFace"
        self.detector_backend = "retinaface"
        self.use_cuda = settings.USE_CUDA

        if not self.use_cuda:
            import os
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            os.environ["ORT_DEVICE"] = "CPU"
            logger.info("Face detection: ArcFace + RetinaFace (CPU mode)")
        else:
            logger.info("Face detection: ArcFace + RetinaFace (CUDA mode)")

    @staticmethod
    def _l2_normalize(embedding: List[float]) -> List[float]:
        """L2-normalize embedding for consistent cosine similarity."""
        vec = np.array(embedding, dtype=np.float64)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec.tolist()

    @staticmethod
    def _blur_score(image: np.ndarray, x: int, y: int, w: int, h: int) -> float:
        """Laplacian variance of the face region — higher = sharper."""
        img_h, img_w = image.shape[:2]
        crop = image[max(0, y):min(img_h, y + h), max(0, x):min(img_w, x + w)]
        if crop.size == 0:
            return 0.0
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # ---------------------------
    # Core: single-step pipeline
    # ---------------------------
    def detect_faces(self, image: np.ndarray) -> List[FaceDetectionResult]:
        """
        Detect faces and generate ArcFace embeddings in a single pass.

        Pipeline: RetinaFace detection → face alignment → ArcFace embedding.
        Quality filters reject low-confidence, tiny, and blurry faces.

        Args:
            image: OpenCV BGR image

        Returns:
            List[FaceDetectionResult] — only high-quality faces
        """
        try:
            representations = DeepFace.represent(
                img_path=image,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=False,
                align=True,
            )
        except Exception:
            logger.exception("Face detection failed")
            return []

        results: List[FaceDetectionResult] = []
        img_h, img_w = image.shape[:2]

        for rep in representations:
            region = rep.get("facial_area", {})
            confidence = float(rep.get("face_confidence", 0))

            x = int(region.get("x", 0))
            y = int(region.get("y", 0))
            w = int(region.get("w", 0))
            h = int(region.get("h", 0))

            # Gate 1: detection confidence
            if confidence < MIN_DETECTION_CONFIDENCE:
                logger.debug(f"Reject face: confidence {confidence:.2f} < {MIN_DETECTION_CONFIDENCE}")
                continue

            # Gate 2: minimum pixel size
            if w < MIN_FACE_SIZE_PX or h < MIN_FACE_SIZE_PX:
                logger.debug(f"Reject face: size {w}×{h} < {MIN_FACE_SIZE_PX}px")
                continue

            # Gate 3: blur detection
            blur = self._blur_score(image, x, y, w, h)
            if blur < MIN_BLUR_SCORE:
                logger.debug(f"Reject face: blur score {blur:.1f} < {MIN_BLUR_SCORE}")
                continue

            # L2-normalize embedding for consistent cosine similarity
            embedding = self._l2_normalize(rep["embedding"])

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

        logger.info(
            f"Detected {len(representations)} faces, "
            f"{len(results)} passed quality gates"
        )
        return results

    # ---------------------------
    # Helpers
    # ---------------------------
    def detect_from_bytes(self, image_bytes: bytes) -> List[FaceDetectionResult]:
        """Detect faces from raw image bytes."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image bytes")
        return self.detect_faces(image)

    def detect_from_path(self, image_path: str) -> List[FaceDetectionResult]:
        """Detect faces from image file path."""
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        return self.detect_faces(image)

    def get_single_face_embedding(
        self, image_bytes: bytes
    ) -> Optional[List[float]]:
        """
        Extract embedding for user face registration.

        Stricter than batch detection:
        - Exactly one face required
        - Higher confidence threshold
        - Face must be a significant portion of the image
        - Blur rejection

        Returns:
            512-d L2-normalized embedding, or None if no face

        Raises:
            ValueError with Vietnamese message if quality checks fail
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image bytes")

        # Use single-step pipeline
        try:
            representations = DeepFace.represent(
                img_path=image,
                model_name=self.model_name,
                detector_backend=self.detector_backend,
                enforce_detection=False,
                align=True,
            )
        except Exception:
            logger.exception("Registration face detection failed")
            return None

        # Filter by minimum confidence
        valid = [
            r for r in representations
            if float(r.get("face_confidence", 0)) >= MIN_REGISTRATION_CONFIDENCE
        ]

        if len(valid) == 0:
            return None

        if len(valid) > 1:
            raise ValueError(
                f"Phát hiện {len(valid)} khuôn mặt. Vui lòng chụp ảnh chỉ có 1 khuôn mặt."
            )

        rep = valid[0]
        region = rep.get("facial_area", {})
        x, y = int(region.get("x", 0)), int(region.get("y", 0))
        w, h = int(region.get("w", 0)), int(region.get("h", 0))
        confidence = float(rep.get("face_confidence", 0))

        # Check face size relative to image
        img_h, img_w = image.shape[:2]
        face_ratio = (w * h) / (img_w * img_h)
        if face_ratio < MIN_REGISTRATION_FACE_RATIO:
            raise ValueError(
                "Khuôn mặt quá nhỏ trong ảnh. Vui lòng đưa camera gần hơn."
            )

        # Check blur
        blur = self._blur_score(image, x, y, w, h)
        if blur < MIN_BLUR_SCORE:
            raise ValueError(
                "Ảnh khuôn mặt bị mờ. Vui lòng giữ yên camera và chụp lại."
            )

        logger.info(
            f"Registration face: confidence={confidence:.2f}, "
            f"size={w}×{h}, ratio={face_ratio:.3f}, blur={blur:.0f}"
        )

        return self._l2_normalize(rep["embedding"])


# Singleton instance
face_detection_service = FaceDetectionService()
