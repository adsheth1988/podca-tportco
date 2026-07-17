import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server-side file writes (needed for episode JSON + audio storage)
  serverExternalPackages: [],
  // Increase API route timeout for episode generation (TTS can take ~30s)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Baseline hardening headers. No CSP here deliberately — audio/episode
  // data is served from GitHub Releases and Vercel Blob (different origins
  // per deploy), so a strict CSP would need per-environment tuning to avoid
  // breaking playback; these headers are safe defaults that don't.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
