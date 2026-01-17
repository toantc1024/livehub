import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Unsplash images
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },

      // Production image domain
      {
        protocol: "https",
        hostname: "livehub.yhcmute.com",
      },

      // Google user profile images
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api-livehub.yhcmute.com",
        pathname: "/**",
      },

      // Local development backend
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
