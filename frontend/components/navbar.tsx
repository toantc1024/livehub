"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Shield } from "lucide-react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

export function Navbar() {
  const { user, isLoading, isAuthenticated, isAdmin, login, logout } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [addBorder, setAddBorder] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const controls = useAnimation();

  useEffect(() => {
    let lastScrollY = 0;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsVisible(currentScrollY <= lastScrollY || currentScrollY < 50);
      setAddBorder(currentScrollY > 20);
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll);
    setIsInitialLoad(false);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    controls.start(isVisible ? "visible" : "hidden");
  }, [isVisible, controls]);

  const headerVariants = {
    hidden: { opacity: 0, y: "-100%" },
    visible: { opacity: 1, y: 0 },
  };

  // Get initials for avatar fallback
  const getInitials = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.header
          initial="hidden"
          animate={controls}
          exit="hidden"
          variants={headerVariants}
          transition={{
            duration: isInitialLoad ? 0.4 : 0.15,
            delay: isInitialLoad ? 0.1 : 0,
            ease: "easeOut",
          }}
          className={cn("fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md")}
        >
          <div className="container flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/ute-logo.png"
                alt="HCMUTE Logo"
                width={44}
                height={44}
                className="block md:hidden rounded-xl transition-transform"
              />
              <Image
                src="/horizontal-ute-logo.png"
                alt="HCMUTE Logo"
                width={240}
                height={80}
                className="hidden md:block rounded-xl transition-transform"
              />
            </Link>

            {/* Right side - Auth */}
            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              ) : isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={user.avatarUrl || ""}
                          alt={user.name || "User"}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      {/* Admin badge */}
                      {isAdmin && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                          <Shield className="h-3 w-3 text-white" />
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-3xl p-2">
                    {/* User info */}
                    <div className="flex items-center gap-3 p-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatarUrl || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate">
                          {user.name || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </span>
                        {isAdmin && (
                          <span className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <Shield className="h-3 w-3" />
                            Quản trị viên
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Admin link */}
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild className="cursor-pointer rounded-xl">
                          <Link href="/admin" className="flex items-center">
                            <Shield className="mr-2 h-4 w-4" />
                            Trang quản trị
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    {/* Logout */}
                    <DropdownMenuItem
                      onClick={logout}
                      className="cursor-pointer group hover:!bg-destructive text-destructive focus:!text-white rounded-xl"
                    >
                      <LogOut className="mr-2 group-hover:text-white h-4 w-4" />
                      Đăng xuất
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={login}
                  className="rounded-full px-6 bg-primary hover:bg-primary/90 text-white transition-all"
                >
                  Đăng nhập
                </Button>
              )}
            </div>
          </div>
          <motion.hr
            initial={{ opacity: 0 }}
            animate={{ opacity: addBorder ? 1 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="absolute w-full bottom-0 border-border"
          />
        </motion.header>
      )}
    </AnimatePresence>
  );
}
