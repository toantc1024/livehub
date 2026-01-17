"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (token) {
      // Store token
      localStorage.setItem("token", token);
      
      // Decode JWT to get role
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const role = payload.role;
        
        // Redirect based on role
        if (role === "ADMIN") {
          router.replace("/admin");
        } else {
          router.replace("/gallery");
        }
      } catch {
        router.replace("/");
      }
    } else {
      router.replace("/?error=auth_failed");
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="text-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse"></div>
          </div>
        </div>
        <p className="text-muted-foreground mt-6 text-lg">Đang đăng nhập...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
          <div className="text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse"></div>
              </div>
            </div>
            <p className="text-muted-foreground mt-6 text-lg">Đang đăng nhập...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
