import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Prevent MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Enable XSS filter in older browsers
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Force HTTPS for 1 year
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Limit referrer data
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Restrict browser features
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress source map upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: true,
  // Disable source map uploads until SENTRY_AUTH_TOKEN is configured
  sourcemaps: {
    disable: true,
  },
});
