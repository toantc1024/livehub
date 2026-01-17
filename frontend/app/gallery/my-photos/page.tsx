"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/ui/loading";
import { api } from "@/lib/api";
import {
  Camera,
  Download,
  ArrowLeft,
  ImageIcon,
  RefreshCw,
  ZoomIn,
  User,
  Images,
  Loader2,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

interface ImageItem {
  id: string;
  filename: string;
  originalUrl: string;
  status: string;
  createdAt: string;
}

interface ImageListResponse {
  items: ImageItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Skeleton loader component for images
function ImageSkeleton() {
  return (
    <div className="aspect-square rounded-2xl bg-gradient-to-br from-muted to-muted/50 animate-pulse relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer" />
    </div>
  );
}

export default function MyPhotosPage() {
  const { user, isLoading, isAuthenticated, needsProfileSetup } = useAuth();
  const router = useRouter();

  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "my-face">("all");
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(
    async (pageNum: number, filterType: "all" | "my-face", append = false) => {
      if (pageNum === 1 && !append) {
        setIsLoadingImages(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        let res: ImageListResponse;
        if (filterType === "my-face") {
          res = await api.getMyFaceImages(pageNum, 16);
        } else {
          res = await api.getRecentImages(pageNum, 16);
        }

        if (append && pageNum > 1) {
          setImages((prev) => [...prev, ...res.items]);
        } else {
          setImages(res.items);
        }

        setTotalPages(res.pages);
        setTotal(res.total);
        setPage(res.page);
      } catch (error) {
        console.error("Failed to fetch images:", error);
      } finally {
        setIsLoadingImages(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }

    // Redirect to profile setup if profile is incomplete
    if (!isLoading && isAuthenticated && needsProfileSetup) {
      router.replace("/gallery/register-face");
    }
  }, [isLoading, isAuthenticated, needsProfileSetup, router]);

  useEffect(() => {
    if (isAuthenticated && !needsProfileSetup) {
      fetchImages(1, filter);
    }
  }, [isAuthenticated, needsProfileSetup, fetchImages, filter]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore && page < totalPages) {
          fetchImages(page + 1, filter, true);
        }
      },
      {
        rootMargin: "300px",
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
  }, [page, totalPages, isLoadingMore, filter, fetchImages]);

  const handleFilterChange = (newFilter: "all" | "my-face") => {
    setFilter(newFilter);
    setPage(1);
    setImages([]);
    setLoadedImages(new Set());
  };

  const handleImageLoad = (imageId: string) => {
    setLoadedImages((prev) => new Set(prev).add(imageId));
  };

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

  if (isLoading) {
    return <PageLoading text="Đang tải..." />;
  }

  if (!isAuthenticated || needsProfileSetup) {
    return <PageLoading text="Đang chuyển hướng..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />

      <main className="container pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link href="/gallery">
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Thư viện ảnh</h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {filter === "my-face"
                    ? total > 0
                      ? `Tìm thấy ${total} ảnh có khuôn mặt của bạn`
                      : "Chưa có ảnh nào có khuôn mặt của bạn"
                    : total > 0
                    ? `${total} ảnh trong thư viện`
                    : "Chưa có ảnh nào trong thư viện"}
                </p>
              </div>
            </div>

            {/* Open embed in new tab */}
            <a
              href="https://livehub.yhcmute.com/gallery/all-photos"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Mở trong tab mới
            </a>
          </div>

          {/* Filter buttons and refresh */}
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
            <div className="flex bg-muted rounded-full p-1 flex-1 xs:flex-none">
              <button
                onClick={() => handleFilterChange("all")}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all flex-1 xs:flex-none ${
                  filter === "all"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Images className="h-4 w-4" />
                <span>Tất cả ảnh</span>
              </button>
              <button
                onClick={() => handleFilterChange("my-face")}
                className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all flex-1 xs:flex-none ${
                  filter === "my-face"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-4 w-4" />
                <span>Ảnh có tôi</span>
              </button>
            </div>

            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setImages([]);
                setLoadedImages(new Set());
                fetchImages(1, filter);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Làm mới
            </Button>
          </div>
        </motion.div>

        {/* Loading state */}
        {isLoadingImages ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
            {[...Array(16)].map((_, i) => (
              <ImageSkeleton key={i} />
            ))}
          </div>
        ) : images.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            </div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2">
              {filter === "my-face"
                ? "Chưa có ảnh nào có khuôn mặt của bạn"
                : "Chưa có ảnh nào"}
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 max-w-md">
              {filter === "my-face"
                ? "Hệ thống chưa tìm thấy ảnh nào có khuôn mặt của bạn. Hãy cập nhật khuôn mặt để bắt đầu."
                : "Thư viện ảnh đang trống. Hãy chờ admin tải ảnh lên."}
            </p>
            {filter === "my-face" && (
              <Link href="/gallery/register-face">
                <Button className="rounded-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Cập nhật khuôn mặt
                </Button>
              </Link>
            )}
          </motion.div>
        ) : (
          /* Photo Grid with Lightbox and Infinite Scroll */
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
                          handleDownload(
                            currentImage.originalUrl,
                            currentImage.filename
                          )
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
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {images.map((image, index) => (
                    <motion.div
                      key={image.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.02, 0.3),
                      }}
                    >
                      <PhotoView src={image.originalUrl}>
                        <div className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-zoom-in">
                          {/* Loading placeholder */}
                          {!loadedImages.has(image.id) && (
                            <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 animate-pulse z-10">
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer" />
                            </div>
                          )}

                          <Image
                            src={image.originalUrl}
                            alt={image.filename}
                            fill
                            unoptimized
                            className={`object-cover transition-all duration-500 group-hover:scale-105 ${
                              loadedImages.has(image.id)
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                            onLoad={() => handleImageLoad(image.id)}
                          />

                          {/* Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 flex items-center justify-between">
                              <span className="text-white text-xs sm:text-sm truncate max-w-[70%]">
                                {image.filename}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(
                                    image.originalUrl,
                                    image.filename
                                  );
                                }}
                                className="p-1.5 sm:p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0"
                              >
                                <Download className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </PhotoView>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </PhotoProvider>

            {/* Load more trigger & indicator */}
            <div ref={loadMoreRef} className="flex items-center justify-center py-8">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Đang tải thêm...</span>
                </div>
              ) : page >= totalPages && images.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Đã hiển thị tất cả {total} ảnh
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>

      {/* Custom styles for skeleton shimmer */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        .skeleton-shimmer {
          animation: shimmer 1.5s infinite;
        }
        
        /* Responsive breakpoint for xs */
        @media (min-width: 480px) {
          .xs\\:flex-row {
            flex-direction: row;
          }
          .xs\\:items-center {
            align-items: center;
          }
          .xs\\:flex-none {
            flex: none;
          }
          .xs\\:inline {
            display: inline;
          }
        }
      `}</style>
    </div>
  );
}
