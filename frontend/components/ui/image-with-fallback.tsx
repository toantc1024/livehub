"use client";

import { useState, useEffect } from "react";
import Image, { ImageProps } from "next/image";
import { ImageIcon } from "lucide-react";

interface ImageWithFallbackProps
  extends Omit<ImageProps, "onError" | "placeholder" | "blurDataURL"> {
  fallbackClassName?: string;
  blurDataURL?: string;
}

// Default blur placeholder (tiny gray image)
export const defaultBlurDataURL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsLCwsKDQsNDQ0LDQ0QEBEQEA8TERETFBQUFBwbHBwgICj/2wBDAQMEBAUEBQkFBQkjDgsOIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyP/wAARCAAIAAgDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIBAAAgICAQUBAAAAAAAAAAAAAQIDBAARBQYSITFRYf/EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AuuoukYeP45L0MjcjGqxRxKSWZiNAAfeyfjGMCv/Z";

/**
 * Image component with error fallback and blur placeholder support.
 * Shows a placeholder icon when image fails to load.
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackClassName,
  className,
  blurDataURL,
  ...props
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Reset state when src changes
  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  // No src provided - show placeholder
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${
          fallbackClassName || className || ""
        }`}
        style={props.fill ? { position: "absolute", inset: 0 } : undefined}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  // Error loading - show placeholder
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${
          fallbackClassName || className || ""
        }`}
        style={props.fill ? { position: "absolute", inset: 0 } : undefined}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
      </div>
    );
  }

  // Use blur placeholder if available for lazy loading effect
  const placeholderProps = blurDataURL
    ? { placeholder: "blur" as const, blurDataURL }
    : {};

  return (
    <>
      {/* Show loading pulse only when no blur placeholder */}
      {isLoading && !blurDataURL && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={{ zIndex: 1 }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        className={className}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
        unoptimized
        {...placeholderProps}
        {...props}
      />
    </>
  );
}
