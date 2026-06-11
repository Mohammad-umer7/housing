/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000'

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Expose backend URL to server-side and edge routes
  env: {
    BACKEND_URL: BACKEND,
  },
  // Proxy /ws/* directly to Python WebSocket server
  async rewrites() {
    return [
      {
        source: '/ws/:path*',
        destination: `${BACKEND}/ws/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
