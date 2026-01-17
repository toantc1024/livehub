import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      "images.unsplash.com",
      "livehub.yhcmute.com",
      "lh3.googleusercontent.com",
    ],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8080", // 👈 MUST MATCH YOUR URL
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
