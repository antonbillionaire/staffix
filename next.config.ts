import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable trailing slash redirect to fix Telegram webhook 307 error
  skipTrailingSlashRedirect: true,
  // Enable compression
  compress: true,
  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Optimize server-only packages to not leak into client bundle
  serverExternalPackages: ["@anthropic-ai/sdk", "pdf-parse", "mammoth", "xlsx"],
};

export default nextConfig;
