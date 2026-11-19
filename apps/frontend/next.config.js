// @ts-check
import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom', 'canvas'],
  experimental: {
    proxyTimeout: 90_000,
    webpackMemoryOptimizations: true,
    webpackBuildWorker: true,
  },
  // Document-Policy header for browser profiling
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Document-Policy',
            value: 'js-profiling',
          },
        ],
      },
    ];
  },
  reactStrictMode: false,
  // Enable production sourcemaps for Sentry
  productionBrowserSourceMaps: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Custom webpack config to ensure sourcemaps are generated properly
  webpack: (config, { buildId, dev, isServer, defaultLoaders }) => {
    // Enable sourcemaps for both client and server in production
    if (!dev && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      config.devtool = isServer ? 'source-map' : 'hidden-source-map';
    }

    return config;
  },
  async redirects() {
    return [
      {
        source: '/api/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local' ? '/uploads/:path*' : '/404',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const backend = process.env.VERCEL_ENV === 'preview'
      ? process.env.STAGING_BACKEND_INTERNAL_URL : process.env.BACKEND_INTERNAL_URL;
    if (process.env.AUTH_PROVIDER === 'supabase' && process.env.VERCEL_ENV === 'preview' && !backend) {
      throw new Error('Configure an isolated staging backend before creating preview deployments');
    }
    return [
      ...(process.env.AUTH_PROVIDER === 'supabase' && backend
        ? [{ source: '/api/backend/:path*', destination: `${backend}/:path*` }]
        : []),
      {
        source: '/uploads/:path*',
        destination:
          process.env.STORAGE_PROVIDER === 'local'
            ? '/api/uploads/:path*'
            : '/404',
      },
    ];
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN ? withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Sourcemap configuration optimized for monorepo
  sourcemaps: {
    disable: false,
    // More comprehensive asset patterns for monorepo
    assets: [
      '.next/static/**/*.js',
      '.next/static/**/*.js.map',
      '.next/server/**/*.js',
      '.next/server/**/*.js.map',
    ],
    ignore: [
      '**/node_modules/**',
      '**/*hot-update*',
      '**/_buildManifest.js',
      '**/_ssgManifest.js',
      '**/*.test.js',
      '**/*.spec.js',
    ],
    deleteSourcemapsAfterUpload: true,
  },

  // Release configuration
  release: {
    create: true,
    finalize: true,
    // Use git commit hash for releases in monorepo
    name:
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || undefined,
  },

  // NextJS specific optimizations for monorepo
  widenClientFileUpload: true,

  // Additional configuration
  telemetry: false,
  silent: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',

  // Error handling for CI/CD
  errorHandler: (error) => {
    console.warn('Sentry build error occurred:', error.message);
    console.warn(
      'This might be due to missing Sentry environment variables or network issues'
    );
    // Don't fail the build if Sentry upload fails in monorepo context
    return;
  },
}) : nextConfig;
