import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opting-in to static export with the NEXT_PUBLIC_STATIC_EXPORT env var;
  // some app router pages (e.g. dynamic or special routes like /_not-found)
  // may not be compatible with `output: 'export'` so make it explicit.
  output: process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true' ? 'export' : undefined,
  // Ensure URLs like /signup do NOT redirect to /signup/ by disabling
  // automatic trailing slashes. We previously enabled trailing slashes
  // for static export in production; turn it off to keep canonical
  // routes without trailing slashes.
  trailingSlash: false,
  images: {
    unoptimized: true
  },
  experimental: {},
  transpilePackages: ['@react-pdf/renderer'],
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_STATIC_EXPORT: 'true',
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
