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
};

export default nextConfig;
