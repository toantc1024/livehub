# LiveHub FastAPI Backend
# Multi-stage build for smaller final image

# ============================================
# Stage 1: Builder - Install dependencies
# ============================================
FROM python:3.11-slim-bullseye AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Runtime - Final image
# ============================================
FROM python:3.11-slim-bullseye AS runtime

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

# Create non-root user for security
RUN groupadd --gid 1000 appgroup && \
    useradd --uid 1000 --gid appgroup --shell /bin/bash --create-home appuser

# Download DeepFace models during build (as root, before switching user)
# This caches models in the image so they don't download at runtime
RUN python -c "from deepface import DeepFace; import numpy as np; \
    img = np.zeros((112,112,3), dtype=np.uint8); \
    DeepFace.represent(img, model_name='ArcFace', detector_backend='retinaface', enforce_detection=False)" \
    || echo "Model pre-download completed or skipped"

# Copy application code
COPY --chown=appuser:appgroup . .

# Remove dev files
RUN rm -rf __pycache__ *.pyc .env.development .env.local tests/ .git/

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default command - API server
# For worker, override with: command: python worker.py
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080"]
