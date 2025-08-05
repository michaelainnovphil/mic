import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ Skip ESLint during Vercel build
  },
  typescript: {
    ignoreBuildErrors: true, // ✅ Skip TS errors during Vercel build
  },
}

export default nextConfig
