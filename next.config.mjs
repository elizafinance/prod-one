import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@orca-so/whirlpools-client': path.resolve(__dirname, 'src/stubs/whirlpools-client.js'),
    };

    // Add optimization configuration
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        // Ensure proper initialization order
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            default: false,
            defaultVendors: false,
            framework: {
              chunks: 'all',
              name: 'framework',
              test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
              priority: 40,
              enforce: true,
            },
            lib: {
              test(module) {
                return module.size() > 160000 &&
                  /node_modules[/\\]/.test(module.identifier());
              },
              name(module) {
                const hash = crypto.createHash('sha1');
                hash.update(module.identifier());
                return hash.digest('hex').slice(0, 8);
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            shared: {
              name(module, chunks) {
                return crypto
                  .createHash('sha1')
                  .update(
                    chunks.reduce((acc, chunk) => {
                      return acc + chunk.name;
                    }, '')
                  )
                  .digest('hex');
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
        runtimeChunk: 'single',
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      };

      // Ensure modules are initialized in the correct order
      config.optimization.moduleIds = 'deterministic';
      config.optimization.chunkIds = 'deterministic';
      
      // Add module concatenation optimization
      config.optimization.concatenateModules = true;
    }

    // Handle 'self' reference error in server-side code
    if (isServer) {
      config.output.globalObject = 'this';
    }

    return config;
  },
  // Add experimental features to help with module initialization
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
  },
  // Enable source maps in production for better debugging
  productionBrowserSourceMaps: true,
  // Disable image optimization warnings
  images: {
    unoptimized: true
  }
};

export default nextConfig;
