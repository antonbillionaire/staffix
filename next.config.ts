import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable trailing slash redirect to fix Telegram webhook 307 error
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
