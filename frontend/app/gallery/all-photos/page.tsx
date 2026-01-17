"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { PageLoading } from "@/components/ui/loading";
import {
  ExternalLink,
  Images,
  User,
} from "lucide-react";
import Link from "next/link";
import { ImageGrid, ImageItem } from "@/components/gallery/image-grid";

interface ImageListResponse {
  items: ImageItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export default function AllPhotosPage() {
  const { isLoading, isAuthenticated, needsProfileSetup } = useAuth();
  const router = useRouter();

  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "my-face">("all");

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
          res = await api.getMyFaceImages(pageNum, 12);
        } else {
          res = await api.getRecentImages(pageNum, 12);
        }
        
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

  // Auth check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
      return;
    }
    if (!isLoading && isAuthenticated && needsProfileSetup) {
      router.replace("/gallery/register-face");
      return;
    }
  }, [isLoading, isAuthenticated, needsProfileSetup, router]);

  // Initial load - only fetch if authenticated and profile complete
  useEffect(() => {
    if (isAuthenticated && !needsProfileSetup) {
      fetchImages(1, filter);
    }
  }, [fetchImages, filter, isAuthenticated, needsProfileSetup]);

  const handleFilterChange = (newFilter: "all" | "my-face") => {
    setFilter(newFilter);
    setPage(1);
    // setImages([]); // Let ImageGrid handle loading state visually, or clear it if you want transition
    // Better UX: keep images until new ones load or show skeleton
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && page < totalPages) {
      fetchImages(page + 1, filter, true);
    }
  };

  if (isLoading) return <PageLoading text="Đang tải..." />;
  if (!isAuthenticated || needsProfileSetup) return <PageLoading text="Đang chuyển hướng..." />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Compact Header for Embed */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                  <Images className="h-4 w-4 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-bold">LiveHub</h1>
              </div>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {filter === "my-face"
                  ? total > 0
                    ? `${total} ảnh có bạn`
                    : "Chưa có ảnh"
                  : total > 0
                  ? `${total} ảnh`
                  : "Chưa có ảnh"}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Filter buttons */}
              <div className="flex bg-muted rounded-full p-1 flex-1 sm:flex-none">
                <button
                  onClick={() => handleFilterChange("all")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-1 sm:flex-none ${
                    filter === "all"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Images className="h-3 w-3" />
                  <span className="hidden xs:inline">Tất cả</span>
                </button>
                <button
                  onClick={() => handleFilterChange("my-face")}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all flex-1 sm:flex-none ${
                    filter === "my-face"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <User className="h-3 w-3" />
                  <span className="hidden xs:inline">Ảnh có tôi</span>
                </button>
              </div>

              {/* View All Button - User request: "do not open new tab but use link in Nextjs" */}
              {/* If this is embedded, it should open in new tab? But user directive says "When click Xem tất cả ảnh do not open new tab but use link in Nextjs" for this file. 
                  Maybe user intends this page to be part of the main app navigation now. 
                  However, "Xem tất cả" button usually implies going to gallery root or similar. 
                  Wait, THIS IS the "All Photos" page. Why is there a "Xem tất cả" button here?
                  In `embed-gallery`, "Xem tất cả" leads to main site.
                  In `gallery` (main), "Xem tất cả" leads to THIS page (or my-photos).
                  
                  If I am ON `all-photos` page, what does "Xem tất cả" button do?
                  Maybe it's redundant? Or maybe it links to filtered view?
                  The existing code had `handleOpenMainSite`.
                  User might mean: "Use link in Nextjs" to avoid full reload if possible, OR user implies this page is now integrated.
                  
                  Let's assume user wants it to be a Link to `/gallery` or `/gallery/my-photos`?
                  Or simply remove it if we are already seeing all photos?
                  But this page is designed as "Embed". It might be viewed in iframe.
                  If it is in iframe, `Link` will navigate INSIDE iframe.
                  If user wants "do not open new tab", it means navigation inside iframe?
                  OR user thinks this page is the main gallery page.
                  
                  Let's look at `frontend/app/embed-gallery` request: "But Xem tất cả will open new tab".
                  This file is `frontend/app/gallery/all-photos`.
                  User said: "@[frontend/app/gallery/all-photos] ... When click Xem tất cả ảnh do not open new tab but use link in Nextjs".
                  
                  I will use Link to `/gallery` for now as "Home" or "Back".
                  Or maybe the button text "Xem tất cả" is confusing here if we are already viewing it.
                  Original code: `Xem tất cả` -> opens `livehub.yhcmute.com` (Main site).
                  So maybe this is "Go to Main Site".
                  If user says "do not open new tab", I'll use `Link href="/"`.
              */}
              <Link href="/gallery">
                 <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="hidden sm:inline">Xem tất cả</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container py-4 px-2 sm:px-4">
         <ImageGrid 
            images={images}
            isLoading={isLoadingImages}
            isLoadingMore={isLoadingMore}
            hasMore={page < totalPages}
            onLoadMore={handleLoadMore}
            emptyMessage={filter === "my-face" ? "Chưa có ảnh nào có khuôn mặt của bạn" : "Chưa có ảnh nào"}
            emptySubMessage={filter === "my-face" ? "Hệ thống chưa tìm thấy ảnh nào có khuôn mặt của bạn." : "Thư viện ảnh đang trống."}
         />
      </main>
    </div>
  );
}
