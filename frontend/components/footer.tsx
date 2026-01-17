"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FooterProps {
  className?: string;
  animate?: boolean;
  animationDelay?: number;
}

export function Footer({ className, animate = false, animationDelay = 0 }: FooterProps) {
  const content = (
    <div className="container flex flex-col items-center gap-3 sm:gap-4 md:gap-5 text-center px-4 sm:px-6">
      <Link href="/" className="transition-transform hover:scale-105">
        <Image
          src="/ute-logo.png"
          alt="HCMUTE Logo"
          width={48}
          height={48}
          className="rounded-xl sm:w-14 sm:h-14"
        />
      </Link>
      <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-relaxed max-w-xs sm:max-w-none">
        <span className="block sm:inline">Thực hiện bởi Phòng Quản trị Thương hiệu &amp; Truyền thông</span>
        <br className="hidden sm:block" />
        <span className="sm:hidden"> - </span>
        <span>Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh</span>
      </p>
    </div>
  );

  if (animate) {
    return (
      <motion.footer
        className={cn("relative z-10 border-t border-border/40 py-6 sm:py-8 md:py-10 mt-auto", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: animationDelay }}
      >
        {content}
      </motion.footer>
    );
  }

  return (
    <footer className={cn("relative z-10 border-t border-border/40 py-6 sm:py-8 md:py-10 mt-auto", className)}>
      {content}
    </footer>
  );
}
