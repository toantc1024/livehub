"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import {
  ExternalLink,
  Images,
  Sparkles,
} from "lucide-react";
import { ImageGrid, ImageItem } from "@/components/gallery/image-grid";
import { FALLBACK_IMAGES } from "@/lib/fallback-images";

interface ImageListResponse {
  items: ImageItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

const PAGE_SIZE = 12;

export default function EmbedGalleryPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const isFallbackRef = useRef(false);

  const loadFallbackPage = useCallback((pageNum: number, append: boolean) => {
    const startIndex = (pageNum - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageItems = FALLBACK_IMAGES.slice(startIndex, endIndex);

    if (append && pageNum > 1) {
      setImages((prev) => [...prev, ...pageItems]);
    } else {
      setImages(pageItems);
    }

    setTotalPages(Math.ceil(FALLBACK_IMAGES.length / PAGE_SIZE));
    setTotal(FALLBACK_IMAGES.length);
    setPage(pageNum);
  }, []);

  const fetchImages = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1 && !append) {
        setIsLoadingImages(true);
      } else {
        setIsLoadingMore(true);
      }

      // If already using fallback data, paginate directly through fallback images
      if (isFallbackRef.current) {
        loadFallbackPage(pageNum, append);
        setIsLoadingImages(false);
        setIsLoadingMore(false);
        return;
      }

      try {
        const res: ImageListResponse = await api.getPublicRecentImages(pageNum, PAGE_SIZE);

        if (res && res.items && res.items.length > 0) {
          if (append && pageNum > 1) {
            setImages((prev) => [...prev, ...res.items]);
          } else {
            setImages(res.items);
          }

          setTotalPages(res.pages || Math.ceil((res.total || res.items.length) / PAGE_SIZE));
          setTotal(res.total || res.items.length);
          setPage(res.page || pageNum);
        } else {
          // No images from API - fall back to local assets
          isFallbackRef.current = true;
          loadFallbackPage(pageNum, append);
        }
      } catch (error) {
        console.warn("Failed to fetch images from API, falling back to /assets folder:", error);
        isFallbackRef.current = true;
        loadFallbackPage(pageNum, append);
      } finally {
        setIsLoadingImages(false);
        setIsLoadingMore(false);
      }
    },
    [loadFallbackPage]
  );

  // Initial load
  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  const handleLoadMore = () => {
    if (!isLoadingMore && page < totalPages) {
      fetchImages(page + 1, true);
    }
  };

  const handleOpenMainSite = () => {
    window.open("https://livehub.yhcmute.com/embed-gallery", "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Compact Header for Embed */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-3 px-3 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Images className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold truncate">LiveHub</h1>
                  <p className="text-xs text-muted-foreground truncate hidden xs:block">
                    {total > 0 ? `${total} ảnh` : "Thư viện ảnh"}
                  </p>
                </div>
              </div>
            </div>

            {/* Open in new tab button */}
            <button
              onClick={handleOpenMainSite}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Xem tất cả</span>
              <span className="xs:hidden">Xem tất cả ảnh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container py-4 px-2 sm:px-4">
        {/* Section Title */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h2 className="text-sm sm:text-base font-semibold truncate">Những khoảnh khắc đáng nhớ</h2>
        </div>

        <ImageGrid
            images={images}
            isLoading={isLoadingImages}
            isLoadingMore={isLoadingMore}
            hasMore={page < totalPages}
            onLoadMore={handleLoadMore}
            gridClassName="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
            emptyMessage="Chưa có ảnh nào"
            emptySubMessage="Thư viện ảnh đang trống."
        />
      </main>

      {/* Custom styles for breakpoint */}
      <style jsx global>{`
        /* Responsive breakpoint for xs */
        @media (min-width: 480px) {
          .xs\\:block {
            display: block;
          }
          .xs\\:inline {
            display: inline;
          }
          .xs\\:hidden {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
