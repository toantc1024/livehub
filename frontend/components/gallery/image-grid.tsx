"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ZoomIn, RefreshCw, Loader2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

export interface ImageItem {
  id: string;
  filename: string;
  originalUrl: string;
  status: string;
  createdAt: string;
  imageData: any;
}

interface ImageGridProps {
  images: ImageItem[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
  emptySubMessage?: string;
  gridClassName?: string;
  sectionTitle?: string; // Optional: "Những khoảnh khắc đáng nhớ"
}

// Skeleton loader component
export function ImageSkeleton() {
  return (
    <div className="aspect-square rounded-2xl bg-gradient-to-br from-muted to-muted/50 animate-pulse relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer" />
    </div>
  );
}

// ... imports ...

// Helper component for card content to avoid duplication
const BLUR_DATA_URL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAQMDBAMAAAAAAAAAAAAAAQIDBAAFEQYSITEHE0H/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABkRAAIDAQAAAAAAAAAAAAAAAAECAAMRIf/aAAwDAQACEQMRAD8AqeM9Y3e43q8RLncJE2LBWGo6HlFQYSpIUck9kk/KKUrDLJkyJUd//9k=";

const ImageCardContent = ({ 
  image, 
  isLoaded, 
  onLoad, 
  onDownload 
}: { 
  image: ImageItem, 
  isLoaded: boolean, 
  onLoad: (id: string) => void,
  onDownload: (url: string, filename: string) => void
}) => (
  <div className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-pointer">
    {/* Loading placeholder */}
    {!isLoaded && (
      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse z-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer" />
      </div>
    )}

    <Image
      src={image.originalUrl}
      alt={image.filename}
      fill
      unoptimized
      placeholder="blur"
      blurDataURL={image?.imageData?.blurDataURL || BLUR_DATA_URL}
      className={`object-cover transition-all duration-300 group-hover:scale-105 ${
        isLoaded ? "opacity-100" : "opacity-0"
      }`}
      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
      onLoad={() => onLoad(image.id)}
    />

    {/* Overlay with Download Button at Bottom Left/Right */}
    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="text-white text-xs truncate max-w-[70%] opacity-90">
            {image.filename}
            </span>
            <button
            onClick={(e) => {
                e.stopPropagation();
                onDownload(image.originalUrl, image.filename);
            }}
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0 backdrop-blur-sm"
            title="Tải ảnh"
            >
            <Download className="h-3.5 w-3.5 text-white" />
            </button>
        </div>
    </div>
  </div>
);

export function ImageGrid({
  images,
  isLoading,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  emptyMessage = "Chưa có ảnh nào",
  emptySubMessage = "Thư viện ảnh hiện đang trống",
  gridClassName = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3",
  onImageClick
}: ImageGridProps & { onImageClick?: (image: ImageItem) => void }) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  };
  
  useEffect(() => {
  }, [images])
  // ... existing handleDownload ...
  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // ... existing useEffect ...
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (!onLoadMore || !hasMore || isLoadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (isLoading) {
    // ... skeleton return ...
    return (
      <div className={gridClassName}>
        {[...Array(12)].map((_, i) => (
          <ImageSkeleton key={i} />
        ))}
        <style jsx global>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .skeleton-shimmer {
            animation: shimmer 1.5s infinite;
          }
        `}</style>
      </div>
    );
  }

  if (images.length === 0) {
    // ... empty state return ...
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 sm:py-20 text-center"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 sm:mb-6">
          <ImageIcon className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
        </div>
        <h2 className="text-base sm:text-lg font-semibold mb-2">{emptyMessage}</h2>
        <p className="text-muted-foreground text-sm max-w-md px-4">
          {emptySubMessage}
        </p>
      </motion.div>
    );
  }

  // If customized click handler is provided, don't use PhotoProvider/PhotoView
  if (onImageClick) {
    return (
      <>
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={gridClassName}
          >
          <AnimatePresence mode="popLayout">
              {images.map((image, index) => (
                <motion.div
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
                  onClick={() => onImageClick(image)}
                >
                   <ImageCardContent 
                      image={image} 
                      isLoaded={loadedImages.has(image.id)} 
                      onLoad={handleImageLoad}
                      onDownload={handleDownload}
                   />
                </motion.div>
              ))}
          </AnimatePresence>
        </motion.div>
        
        {/* Load more trigger & indicator */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center py-8">
              {isLoadingMore ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Đang tải thêm...</span>
              </div>
              ) : null}
          </div>
        )}
        {!hasMore && images.length > 0 && onLoadMore && (
          <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">Đã hiển thị tất cả ảnh</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PhotoProvider
        toolbarRender={({ onScale, scale, onRotate, rotate, index }) => {
          const currentImage = images[index];
          return (
            <div className="flex items-center gap-2">
              <button
                className="PhotoView-Slider__toolbarIcon"
                onClick={() => onScale(scale + 0.5)}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                className="PhotoView-Slider__toolbarIcon"
                onClick={() => onRotate(rotate + 90)}
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              {currentImage && (
                <button
                  className="PhotoView-Slider__toolbarIcon"
                  onClick={() =>
                    handleDownload(currentImage.originalUrl, currentImage.filename)
                  }
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          );
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={gridClassName}
        >
          <AnimatePresence mode="popLayout">
            {images.map((image, index) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.2) }}
              >
                <PhotoView src={image.originalUrl}>
                   {/* Wrap inside a div because PhotoView expects a single child and attaches props to it */}
                   <div className="w-full h-full"> 
                      <ImageCardContent 
                        image={image} 
                        isLoaded={loadedImages.has(image.id)} 
                        onLoad={handleImageLoad}
                        onDownload={handleDownload}
                     />
                   </div>
                </PhotoView>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </PhotoProvider>

      {/* Load more trigger & indicator */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
            {isLoadingMore ? (
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Đang tải thêm...</span>
            </div>
            ) : null}
        </div>
      )}
      {!hasMore && images.length > 0 && onLoadMore && (
        <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Đã hiển thị tất cả ảnh</p>
        </div>
      )}

      {/* Styles */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </>
  );
}
