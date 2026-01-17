"""
LiveHub Uploader - Image Processing

Optimized for high quality with minimal file size.
Uses progressive compression to find optimal quality setting.
"""

import io
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageEnhance, ExifTags


# Configuration
MAX_FILE_SIZE_MB = 8  # Target max file size in MB (nginx default is 10MB)
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
MAX_DIMENSION = 4096  # Max width/height in pixels
MIN_QUALITY = 60  # Minimum JPEG quality to maintain
START_QUALITY = 85  # Starting quality for optimization
QUALITY_STEP = 5  # Quality reduction step during optimization


def get_exif_orientation(img: Image.Image) -> Optional[int]:
    """Get EXIF orientation value."""
    try:
        exif = img._getexif()
        if exif:
            for tag, value in exif.items():
                if ExifTags.TAGS.get(tag) == 'Orientation':
                    return value
    except (AttributeError, KeyError, IndexError):
        pass
    return None


def fix_orientation(img: Image.Image) -> Image.Image:
    """Fix image orientation based on EXIF data."""
    orientation = get_exif_orientation(img)
    
    if orientation is None:
        return img
    
    # Apply transformations based on EXIF orientation
    if orientation == 2:
        return img.transpose(Image.FLIP_LEFT_RIGHT)
    elif orientation == 3:
        return img.rotate(180)
    elif orientation == 4:
        return img.transpose(Image.FLIP_TOP_BOTTOM)
    elif orientation == 5:
        return img.rotate(-90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
    elif orientation == 6:
        return img.rotate(-90, expand=True)
    elif orientation == 7:
        return img.rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
    elif orientation == 8:
        return img.rotate(90, expand=True)
    
    return img


def load_image(image_path: str) -> Image.Image:
    """Load image from path and fix orientation."""
    img = Image.open(image_path)
    
    # Convert to RGB if needed (for PNG with transparency, etc.)
    if img.mode in ('RGBA', 'LA', 'P'):
        # Create white background
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    # Fix orientation based on EXIF
    img = fix_orientation(img)
    
    return img


def resize_image(img: Image.Image, max_size: int = MAX_DIMENSION) -> Image.Image:
    """Resize image if larger than max dimension while maintaining aspect ratio."""
    if max(img.size) <= max_size:
        return img
    
    # Calculate new size maintaining aspect ratio
    ratio = max_size / max(img.size)
    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
    
    # Use high-quality resampling
    return img.resize(new_size, Image.LANCZOS)


def beautify_image(image_path: str) -> Image.Image:
    """
    Load and optionally enhance image.
    
    Currently just loads the image. Enhancement can be enabled if needed.
    """
    img = load_image(image_path)
    
    # Optional: Subtle enhancement (commented out for now)
    # Uncomment to enable slight color/contrast boost:
    # enhancer = ImageEnhance.Color(img)
    # img = enhancer.enhance(1.05)  # Slight color boost
    # enhancer = ImageEnhance.Contrast(img)
    # img = enhancer.enhance(1.02)  # Slight contrast boost
    
    return img


def compress_image_to_bytes(
    img: Image.Image,
    quality: int = START_QUALITY,
    optimize: bool = True
) -> bytes:
    """Compress image to JPEG bytes."""
    buffer = io.BytesIO()
    img.save(
        buffer,
        format='JPEG',
        quality=quality,
        optimize=optimize,
        progressive=True,  # Progressive JPEG for better web loading
    )
    return buffer.getvalue()


def optimize_image(
    img: Image.Image,
    max_file_size: int = MAX_FILE_SIZE_BYTES,
    target_quality: int = START_QUALITY
) -> Tuple[bytes, int]:
    """
    Optimize image to be under max file size while maintaining highest possible quality.
    
    Uses progressive quality reduction until file size is acceptable.
    
    Returns:
        Tuple of (image_bytes, final_quality)
    """
    current_img = img
    quality = target_quality
    
    # First, resize if needed
    current_img = resize_image(current_img, MAX_DIMENSION)
    
    # Try compressing at starting quality
    img_bytes = compress_image_to_bytes(current_img, quality)
    
    # If still too large, progressively reduce quality
    while len(img_bytes) > max_file_size and quality > MIN_QUALITY:
        quality -= QUALITY_STEP
        img_bytes = compress_image_to_bytes(current_img, quality)
        print(f"  Reducing quality to {quality}% (size: {len(img_bytes) / 1024 / 1024:.2f} MB)")
    
    # If still too large at minimum quality, resize down further
    if len(img_bytes) > max_file_size:
        scale_factor = 0.9
        while len(img_bytes) > max_file_size and max(current_img.size) > 1024:
            new_size = (
                int(current_img.size[0] * scale_factor),
                int(current_img.size[1] * scale_factor)
            )
            current_img = img.resize(new_size, Image.LANCZOS)
            img_bytes = compress_image_to_bytes(current_img, quality)
            print(f"  Resizing to {new_size[0]}x{new_size[1]} (size: {len(img_bytes) / 1024 / 1024:.2f} MB)")
    
    return img_bytes, quality


def process_for_upload(image_path: str) -> Tuple[bytes, str, dict]:
    """
    Process image for upload: load, optimize, and return bytes.
    
    Returns:
        Tuple of (image_bytes, filename, metadata)
    """
    print(f"Processing: {image_path}")
    
    # Load and fix orientation
    img = load_image(image_path)
    original_size = img.size
    
    # Get original file size
    original_file_size = Path(image_path).stat().st_size
    print(f"  Original: {original_size[0]}x{original_size[1]}, {original_file_size / 1024 / 1024:.2f} MB")
    
    # Optimize for upload
    img_bytes, final_quality = optimize_image(img)
    final_size = len(img_bytes)
    
    print(f"  Optimized: Quality {final_quality}%, {final_size / 1024 / 1024:.2f} MB")
    
    # Generate filename (keep original name but change extension to .jpg)
    original_path = Path(image_path)
    filename = original_path.stem + ".jpg"
    
    metadata = {
        "original_size": original_size,
        "original_file_size": original_file_size,
        "optimized_file_size": final_size,
        "quality": final_quality,
        "compression_ratio": original_file_size / final_size if final_size > 0 else 0,
    }
    
    return img_bytes, filename, metadata
