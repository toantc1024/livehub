import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "LiveHub - Hình ảnh sự kiện",
  description: "Lưu trữ và chia sẻ những khoảnh khắc đáng nhớ tại HCMUTE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
