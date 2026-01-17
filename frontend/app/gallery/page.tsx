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
  Image as ImageIcon,
  Search,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ZoomIn,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

interface ImageItem {
  id: string;
  filename: string;
  originalUrl: string;
  status: string;
  createdAt: string;
}

export default function GalleryPage() {
  const { user, isLoading, isAuthenticated, login, needsProfileSetup } =
    useAuth();
  const router = useRouter();
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [totalImages, setTotalImages] = useState(0);

  const fetchRecentImages = useCallback(async () => {
    try {
      setIsLoadingImages(true);
      const res = await api.getRecentImages(1, 6);
      setRecentImages(res.items || []);
      setTotalImages(res.total || 0);
    } catch (error) {
      console.error("Failed to fetch recent images:", error);
    } finally {
      setIsLoadingImages(false);
    }
  }, []);

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
      fetchRecentImages();
    }
  }, [isAuthenticated, needsProfileSetup, fetchRecentImages]);

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
          className="text-center mb-12"
        >
          <h1 className="text-3xl font-bold mb-2">Thư viện ảnh của bạn</h1>
          <p className="text-muted-foreground">
            Xin chào,{" "}
            <span className="font-medium text-foreground">
              {user?.name || "bạn"}
            </span>
            ! Tìm và tải về những bức ảnh có bạn trong các sự kiện.
          </p>
        </motion.div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          {/* Update Info Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="group relative p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                  <Camera className="h-8 w-8 text-primary" />
                </div>

                <h3 className="text-xl font-semibold mb-2">
                  Cập nhật thông tin
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Cập nhật thông tin cá nhân và khuôn mặt của bạn để hệ thống
                  nhận diện chính xác hơn.
                </p>

                <Link href="/gallery/register-face">
                  <Button className="rounded-full group/btn">
                    Cập nhật
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Find My Photos Card */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="group relative p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-3xl transform translate-x-10 -translate-y-10" />

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                  <Search className="h-8 w-8 text-primary" />
                </div>

                <h3 className="text-xl font-semibold mb-2">Tìm ảnh của tôi</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Xem tất cả những bức ảnh mà hệ thống đã phát hiện có khuôn mặt
                  của bạn.
                </p>

                <Link href="/gallery/my-photos">
                  <Button
                    variant="outline"
                    className="rounded-full group/btn border-primary/30 hover:bg-primary/10 hover:text-primary"
                  >
                    Xem ảnh
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recent Moments Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Những khoảnh khắc đáng nhớ
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {totalImages > 0
                  ? `Đã có ${totalImages} ảnh trong hệ thống`
                  : "Khám phá những bức ảnh mới nhất"}
              </p>
            </div>
            <a
              href="https://livehub.yhcmute.com/gallery/all-photos"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" className="rounded-full group/btn">
                Xem tất cả ảnh
                <ChevronRight className="ml-1 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            </a>
          </div>

          {isLoadingImages ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : recentImages.length > 0 ? (
            <PhotoProvider>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {recentImages.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <PhotoView src={image.originalUrl}>
                      <div className="group relative aspect-square rounded-2xl overflow-hidden bg-muted cursor-zoom-in">
                        <Image
                          src={image.originalUrl}
                          alt={image.filename}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-110"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </PhotoView>
                  </motion.div>
                ))}
              </div>
            </PhotoProvider>
          ) : (
            <div className="text-center py-16 bg-card rounded-3xl border">
              <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Chưa có ảnh nào trong hệ thống
              </p>
            </div>
          )}
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-xl font-semibold text-center mb-8">
            Cách hoạt động
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Cập nhật khuôn mặt",
                description: "Upload một bức ảnh selfie rõ nét",
                icon: Camera,
              },
              {
                step: "2",
                title: "AI phân tích",
                description: "Hệ thống tự động quét và đối chiếu",
                icon: Sparkles,
              },
              {
                step: "3",
                title: "Nhận ảnh",
                description: "Xem và tải về ảnh có bạn",
                icon: ImageIcon,
              },
            ].map((item, index) => (
              <div key={item.step} className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                    {item.step}
                  </span>
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
