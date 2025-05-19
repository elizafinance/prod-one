import path from 'path';
import { fileURLToPath } from 'url';
import withPWAInit from "next-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
  runtimeCaching: [
    {
      urlPattern: /^\/api\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
    {
      urlPattern: /\.(?:png|gif|jpg|jpeg|svg|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@orca-so/whirlpools-client': path.resolve(__dirname, 'src/stubs/whirlpools-client.js'),
    };
    return config;
  },
};

export default withPWA(nextConfig);
