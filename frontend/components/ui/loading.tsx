"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "md",
  className,
  text,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-12 w-12 border-2",
    lg: "h-16 w-16 border-3",
  };

  const spinner = (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-b-primary border-transparent",
          sizeClasses[size]
        )}
        style={{ borderStyle: "solid" }}
      />
      {text && <p className="text-muted-foreground text-sm">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        {spinner}
      </div>
    );
  }

  return spinner;
}

export function PageLoading({ text = "Đang tải..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
