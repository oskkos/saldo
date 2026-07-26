/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.VERCEL ? {} : { distDir: 'build' }),

  // End-to-end coverage maps V8 profiles back to source, which needs source maps
  // for both runtimes. Only emitted under E2E_COVERAGE — the shipped build is
  // unchanged, and this switch adds no code transform, only maps.
  ...(process.env.E2E_COVERAGE
    ? {
        productionBrowserSourceMaps: true,
        experimental: { serverSourceMaps: true },
      }
    : {}),

  images: {
    remotePatterns: [
      {
        hostname: '*.googleusercontent.com',
      },
      {
        hostname: '*.githubusercontent.com',
      },
    ],
  },
};

// Injected content via Sentry wizard below
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during build
    silent: true,

    org: 'oskari-kosonen',
    project: 'saldo',
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: '/monitoring',

    // Hides source maps from generated client bundles. Kept on except when
    // collecting coverage: without a sourceMappingURL the browser profile cannot
    // be mapped back to src/.
    hideSourceMaps: !process.env.E2E_COVERAGE,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,
  },
);
