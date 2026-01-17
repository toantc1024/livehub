"use client";

import { useEffect, useState, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Images,
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

export default function MyPhotosPage() {
  const { user, isLoading, isAuthenticated, needsProfileSetup } = useAuth();
  const router = useRouter();

  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "my-face">("all");

  const fetchImages = useCallback(
    async (pageNum: number, filterType: "all" | "my-face") => {
      setIsLoadingImages(true);
      try {
        let res: ImageListResponse;
        if (filterType === "my-face") {
          res = await api.getMyFaceImages(pageNum, 20);
        } else {
          res = await api.getRecentImages(pageNum, 20);
        }
        setImages(res.items);
        setTotalPages(res.pages);
        setTotal(res.total);
        setPage(res.page);
      } catch (error) {
        console.error("Failed to fetch images:", error);
      } finally {
        setIsLoadingImages(false);
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

  const handleFilterChange = (newFilter: "all" | "my-face") => {
    setFilter(newFilter);
    setPage(1);
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

      <main className="container pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <Link href="/gallery">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Thư viện ảnh</h1>
              <p className="text-muted-foreground">
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

          {/* Filter buttons and refresh */}
          <div className="flex items-center gap-4">
            <div className="flex bg-muted rounded-full p-1">
              <button
                onClick={() => handleFilterChange("all")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === "all"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Images className="h-4 w-4" />
                Tất cả ảnh
              </button>
              <button
                onClick={() => handleFilterChange("my-face")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === "my-face"
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-4 w-4" />
                Ảnh có tôi
              </button>
            </div>

            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => fetchImages(page, filter)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Làm mới
            </Button>
          </div>
        </motion.div>

        {/* Loading state */}
        {isLoadingImages ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Đang tải ảnh...</p>
          </div>
        ) : images.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <ImageIcon className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              {filter === "my-face"
                ? "Chưa có ảnh nào có khuôn mặt của bạn"
                : "Chưa có ảnh nào"}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
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
          /* Photo Grid with Lightbox */
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
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {images.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <PhotoView src={image.originalUrl} key={image.id}>
                      <div className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-zoom-in">
                        <Image
                          src={image.originalUrl}
                          alt={image.filename}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                            <span className="text-white text-sm truncate">
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
                              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                            >
                              <Download className="h-4 w-4 text-white" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </PhotoView>
                  </motion.div>
                ))}
              </motion.div>
            </PhotoProvider>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => fetchImages(page - 1, filter)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="px-4 py-2 text-sm">
                  Trang {page} / {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => fetchImages(page + 1, filter)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
