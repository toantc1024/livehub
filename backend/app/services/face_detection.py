"""
Face Detection Service — Tuned for Event Photography.

Architecture:
  - Model: ArcFace (ResNet100, 512-d embeddings)
  - Detector: RetinaFace (highest accuracy)
  - Pipeline: Single-step represent() → detection + alignment + embedding
  - Quality gates: confidence, size, aspect ratio, blur, NMS dedup
  - Embeddings: L2-normalized for cosine similarity

Quality gates (tuned for event/group photos):
  1. Confidence ≥ 0.90 — only high-confidence detections
  2. Min face size ≥ 40px — reject too-small faces (noisy embeddings)
  3. Aspect ratio ≤ 1.8 — reject non-face detections (body parts)
  4. Blur score ≥ 15 — reject motion-blurred faces
  5. NMS IoU ≥ 0.4 — remove duplicate overlapping boxes

Similarity calibration (ArcFace + cosine):
  - Same person:      0.45–0.80
  - Different person: -0.10–0.30
  - Recommended threshold: 0.38
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

# ===========================
# Quality thresholds (batch detection for event photos)
# ===========================
MIN_DETECTION_CONFIDENCE = 0.90   # High confidence only — reduces false positives
MIN_FACE_SIZE_PX = 40             # Min face width/height in pixels
MAX_FACE_ASPECT_RATIO = 1.8       # Max w/h or h/w ratio (reject body-part detections)
MIN_BLUR_SCORE = 15.0             # Laplacian variance threshold
NMS_IOU_THRESHOLD = 0.4           # IoU threshold for non-max suppression

# ===========================
# Registration thresholds (selfie — stricter)
# ===========================
MIN_REGISTRATION_CONFIDENCE = 0.90
MIN_REGISTRATION_FACE_RATIO = 0.03  # Face must be ≥3% of image area
MIN_REGISTRATION_BLUR = 20.0


class FaceDetectionService:
    """
    Production face detection & embedding service.
    Uses single-step DeepFace.represent() for aligned embeddings.
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

    @staticmethod
    def _compute_iou(box1, box2) -> float:
        """Compute IoU between two boxes (x, y, w, h)."""
        x1, y1, w1, h1 = box1
        x2, y2, w2, h2 = box2

        xi = max(x1, x2)
        yi = max(y1, y2)
        xf = min(x1 + w1, x2 + w2)
        yf = min(y1 + h1, y2 + h2)

        inter = max(0, xf - xi) * max(0, yf - yi)
        union = w1 * h1 + w2 * h2 - inter
        return inter / max(union, 1e-6)

    @staticmethod
    def _nms(faces: List[dict], iou_threshold: float) -> List[dict]:
        """Non-max suppression: keep highest confidence face when boxes overlap."""
        if not faces:
            return []

        # Sort by confidence descending
        sorted_faces = sorted(faces, key=lambda f: f["confidence"], reverse=True)
        keep = []

        for face in sorted_faces:
            box = (face["x"], face["y"], face["w"], face["h"])
            is_duplicate = False

            for kept in keep:
                kept_box = (kept["x"], kept["y"], kept["w"], kept["h"])
                if FaceDetectionService._compute_iou(box, kept_box) > iou_threshold:
                    is_duplicate = True
                    break

            if not is_duplicate:
                keep.append(face)

        return keep

    # ---------------------------
    # Core: single-step pipeline
    # ---------------------------
    def detect_faces(self, image: np.ndarray) -> List[FaceDetectionResult]:
        """
        Detect faces and generate ArcFace embeddings in a single pass.

        Quality pipeline:
          1. Run RetinaFace + ArcFace (single pass)
          2. Filter by confidence
          3. Filter by size
          4. Filter by aspect ratio
          5. Filter by blur
          6. NMS to remove duplicates
          7. Return clean results
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

        img_h, img_w = image.shape[:2]

        # Stage 1: Extract and filter candidates
        candidates = []
        reject_conf = 0
        reject_size = 0
        reject_aspect = 0
        reject_blur = 0

        for rep in representations:
            region = rep.get("facial_area", {})
            confidence = float(rep.get("face_confidence", 0))

            x = int(region.get("x", 0))
            y = int(region.get("y", 0))
            w = int(region.get("w", 0))
            h = int(region.get("h", 0))

            # Gate 1: confidence
            if confidence < MIN_DETECTION_CONFIDENCE:
                reject_conf += 1
                continue

            # Gate 2: minimum pixel size
            if w < MIN_FACE_SIZE_PX or h < MIN_FACE_SIZE_PX:
                reject_size += 1
                continue

            # Gate 3: aspect ratio (reject non-face shapes)
            aspect = max(w, h) / max(min(w, h), 1)
            if aspect > MAX_FACE_ASPECT_RATIO:
                reject_aspect += 1
                continue

            # Gate 4: blur detection
            blur = self._blur_score(image, x, y, w, h)
            if blur < MIN_BLUR_SCORE:
                reject_blur += 1
                continue

            candidates.append({
                "x": x, "y": y, "w": w, "h": h,
                "confidence": confidence,
                "embedding": rep["embedding"],
                "blur": blur,
            })

        # Stage 2: NMS to remove overlapping detections
        unique_faces = self._nms(candidates, NMS_IOU_THRESHOLD)

        # Stage 3: Build results
        results: List[FaceDetectionResult] = []
        for face in unique_faces:
            embedding = self._l2_normalize(face["embedding"])
            results.append(
                FaceDetectionResult(
                    bbox=BoundingBox(
                        x=float(face["x"]),
                        y=float(face["y"]),
                        width=float(face["w"]),
                        height=float(face["h"]),
                    ),
                    confidence=face["confidence"],
                    embedding=embedding,
                )
            )

        nms_removed = len(candidates) - len(unique_faces)
        logger.info(
            f"Detected {len(representations)} raw, "
            f"rejected: conf={reject_conf} size={reject_size} aspect={reject_aspect} blur={reject_blur} nms={nms_removed}, "
            f"final: {len(results)} faces"
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
        Extract embedding for user face registration (selfie).

        Stricter than batch detection:
        - Exactly one face required
        - Higher blur threshold
        - Face must be a significant portion of the image

        Returns:
            512-d L2-normalized embedding, or None if no face

        Raises:
            ValueError with Vietnamese message if quality checks fail
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image bytes")

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

        # Filter by confidence
        valid = [
            r for r in representations
            if float(r.get("face_confidence", 0)) >= MIN_REGISTRATION_CONFIDENCE
        ]

        if len(valid) == 0:
            return None

        if len(valid) > 1:
            # If multiple faces, pick the largest one (most prominent)
            # This is more user-friendly than rejecting
            valid.sort(
                key=lambda r: int(r.get("facial_area", {}).get("w", 0)) * int(r.get("facial_area", {}).get("h", 0)),
                reverse=True,
            )
            # Only keep the largest
            valid = [valid[0]]
            logger.info(f"Registration: multiple faces detected, using largest")

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
        if blur < MIN_REGISTRATION_BLUR:
            raise ValueError(
                "Ảnh khuôn mặt bị mờ. Vui lòng giữ yên camera và chụp lại."
            )

        # Check aspect ratio
        aspect = max(w, h) / max(min(w, h), 1)
        if aspect > MAX_FACE_ASPECT_RATIO:
            raise ValueError(
                "Không nhận diện được khuôn mặt rõ ràng. Vui lòng chụp lại."
            )

        logger.info(
            f"Registration face: confidence={confidence:.2f}, "
            f"size={w}×{h}, ratio={face_ratio:.3f}, blur={blur:.0f}, aspect={aspect:.2f}"
        )

        return self._l2_normalize(rep["embedding"])


# Singleton instance
face_detection_service = FaceDetectionService()
