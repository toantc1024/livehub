"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { GridPattern } from "@/components/ui/grid-pattern";
import { motion } from "framer-motion";
import { AuroraText } from "@/components/ui/aurora-text";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Camera, Users, Sparkles, ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ImageGrid, ImageItem } from "@/components/gallery/image-grid";

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

const features = [
  {
    icon: Camera,
    title: "Lưu trữ thông minh",
    description: "Upload và quản lý hình ảnh sự kiện một cách dễ dàng",
  },
  {
    icon: Users,
    title: "Nhận diện khuôn mặt",
    description: "AI tự động tìm ảnh có bạn trong hàng ngàn bức ảnh",
  },
  {
    icon: Sparkles,
    title: "Tìm kiếm nhanh",
    description: "Chỉ cần một selfie để tìm tất cả ảnh của bạn",
  },
];

export default function HomePage() {
  const { isAuthenticated, isLoading, login, user, isAdmin } = useAuth();
  const [recentImages, setRecentImages] = useState<ImageItem[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  useEffect(() => {
    async function fetchImages() {
      try {
        setIsLoadingImages(true);
        // Use different API based on auth status
        const res = isAuthenticated
          ? await api.getRecentImages(1, 6)
          : await api.getPublicRecentImages(1, 6);
        setRecentImages(res.items || []);
      } catch (error) {
        console.error(error);
        setRecentImages([]);
      } finally {
        setIsLoadingImages(false);
      }
    }
    
    // Only fetch after auth loading is complete
    if (!isLoading) {
      fetchImages();
    }
  }, [isAuthenticated, isLoading]);
  
  const displayImages = recentImages;
  
  // If not authenticated (or authenticated but no images), we show empty state.
  const handleImageClick = undefined;

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden">
      {/* Background Grid */}
      <div className="absolute z-[-1] flex h-[300px] sm:h-[400px] lg:h-[500px] w-full flex-col items-center justify-center rounded-lg">
        <GridPattern
          squares={[
            [4, 4],
            [5, 1],
            [8, 2],
            [5, 3],
            [5, 5],
            [10, 10],
            [12, 15],
            [10, 15],
          ]}
          className={cn(
            "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)] sm:[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]",
            "inset-x-0 inset-y-[10%] h-[200%] skew-y-12"
          )}
        />
      </div>

      {/* Navbar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6, ease }}
      >
        <Navbar />
      </motion.div>

      <main className="container flex-1 pt-32 pb-8 relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-12">
          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-3">
            <motion.span
              className="inline-block px-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0, ease }}
            >
              <AuroraText>LiveHub</AuroraText>
            </motion.span>
            <motion.span
              className="inline-block px-2 text-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease }}
            >
              Hình ảnh sự kiện
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease }}
          >
            Lưu trữ và chia sẻ những khoảnh khắc đáng nhớ tại HCMUTE
          </motion.p>

          {/* CTA Button - Center */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45, ease }}
          >
            {isLoading ? (
              <div className="h-12 w-40 mx-auto rounded-full bg-muted animate-pulse" />
            ) : isAuthenticated ? (
              <Link href={isAdmin ? "/admin" : "/gallery"}>
                <Button size="lg" className="rounded-full px-8 text-lg group">
                  {isAdmin ? "Trang quản trị" : "Xem ảnh của bạn"}
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                onClick={login}
                className="rounded-full px-8 text-lg group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Đăng nhập với Google
              </Button>
            )}
          </motion.div>
        </div>

        {/* Features */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease }}
        >
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="relative p-6 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </motion.div>

        {/* Example Images Gallery / Recent Moments */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8, ease }}
        >
          <div className="flex items-center justify-between max-w-5xl mx-auto mb-8 px-2">
            <h2 className="text-lg sm:text-2xl font-semibold truncate">
              Những khoảnh khắc đáng nhớ
            </h2>
            {isAuthenticated ? (
                <Link href="/gallery/my-photos">
                  <Button variant="ghost" className="rounded-full group flex-shrink-0">
                    <span className="hidden sm:inline">Xem tất cả</span>
                    <span className="sm:hidden">Xem</span>
                    <ArrowRight className="ml-1 sm:ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
            ) : (
                <Link href="/browse">
                  <Button variant="ghost" className="rounded-full group flex-shrink-0">
                    <span className="hidden sm:inline">Xem tất cả</span>
                    <span className="sm:hidden">Xem</span>
                    <ArrowRight className="ml-1 sm:ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
            )}
          </div>
          
           <div className="max-w-5xl mx-auto px-2">
             <ImageGrid
                 images={displayImages}
                 isLoading={isLoadingImages}
                 hasMore={false}
                 gridClassName="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
                 onImageClick={handleImageClick}
             />
           </div>
        </motion.div>
      </main>

      {/* Footer */}
      <Footer animate animationDelay={0.6} />
    </div>
  );
}