"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ExternalLink,
  Images,
  LogIn,
} from "lucide-react";
import Link from "next/link";
import { ImageGrid, ImageItem } from "@/components/gallery/image-grid";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

interface ImageListResponse {
  items: ImageItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export default function PublicGalleryPage() {
  const { isAuthenticated, login, isLoading: isAuthLoading } = useAuth();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchImages = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1 && !append) {
        setIsLoadingImages(true);
      } else {
        setIsLoadingMore(true);
      }
      
      try {
        // Use public API - no auth required
        const res: ImageListResponse = await api.getPublicRecentImages(pageNum, 20);
        
        if (append && pageNum > 1) {
          setImages(prev => [...prev, ...res.items]);
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

  // Initial load
  useEffect(() => {
    fetchImages(1);
  }, [fetchImages]);

  const handleLoadMore = () => {
    if (!isLoadingMore && page < totalPages) {
      fetchImages(page + 1, true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Images className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Thư viện ảnh</h1>
                  <p className="text-sm text-muted-foreground">
                    {total > 0 ? `${total} ảnh` : "Chưa có ảnh"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Login prompt for face filtering */}
              {!isAuthenticated && !isAuthLoading && (
                <Button
                  onClick={login}
                  variant="outline"
                  className="rounded-full gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Đăng nhập để tìm ảnh của bạn</span>
                  <span className="sm:hidden">Đăng nhập</span>
                </Button>
              )}
              
              {isAuthenticated && (
                <Link href="/gallery/my-photos">
                  <Button variant="default" className="rounded-full gap-2">
                    <Images className="h-4 w-4" />
                    <span className="hidden sm:inline">Xem ảnh của tôi</span>
                    <span className="sm:hidden">Ảnh của tôi</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="container flex-1 py-6 px-2 sm:px-4">
        <ImageGrid 
          images={images}
          isLoading={isLoadingImages}
          isLoadingMore={isLoadingMore}
          hasMore={page < totalPages}
          onLoadMore={handleLoadMore}
          emptyMessage="Chưa có ảnh nào"
          emptySubMessage="Thư viện ảnh đang trống."
        />
      </main>
      
      <Footer />
    </div>
  );
}
