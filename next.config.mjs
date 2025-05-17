import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

export default nextConfig;
