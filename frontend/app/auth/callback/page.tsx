"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate processing
    if (processedRef.current) return;
    
    const handleCallback = async () => {
      const token = searchParams.get("token");
      
      if (!token) {
        setStatus("error");
        router.replace("/?error=auth_failed");
        return;
      }

      // Mark as processed immediately
      processedRef.current = true;
      
      try {
        // Clear any existing token first
        localStorage.removeItem("token");
        
        // Wait a bit to ensure clear is synced
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Store new token
        localStorage.setItem("token", token);
        
        // Wait longer to ensure localStorage is fully synced across tabs
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify token was stored correctly (with retry)
        let storedToken = localStorage.getItem("token");
        let retryCount = 0;
        while (storedToken !== token && retryCount < 3) {
          await new Promise(resolve => setTimeout(resolve, 100));
          storedToken = localStorage.getItem("token");
          retryCount++;
        }
        
        if (storedToken !== token) {
          console.error("Token storage failed after retries");
          setStatus("error");
          processedRef.current = false;
          router.replace("/?error=storage_failed");
          return;
        }
        
        // Decode JWT to get role
        const payload = JSON.parse(atob(token.split(".")[1]));
        const role = payload.role;
        
        // Check token expiration
        const exp = payload.exp * 1000;
        if (Date.now() >= exp) {
          console.error("Token is expired");
          localStorage.removeItem("token");
          setStatus("error");
          processedRef.current = false;
          router.replace("/?error=token_expired");
          return;
        }
        
        setStatus("success");
        
        // Longer delay to ensure auth context has time to pick up the new token
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Use window.location for a full page navigation to ensure fresh state
        if (role === "ADMIN") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/gallery";
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        setStatus("error");
        localStorage.removeItem("token");
        processedRef.current = false;
        router.replace("/?error=auth_failed");
      }
    };
    
    handleCallback();
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
