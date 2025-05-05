// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don’t fail the build on lint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don’t fail the build on TS errors (use with caution)
    ignoreBuildErrors: true,
  },
  images: {
    // Disable Next.js’s built‑in Image Optimization
    unoptimized: true,
  },
  // swcMinify was removed in Next.js 15 and is no longer recognized
}

export default nextConfig
