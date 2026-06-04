/** @type {import('next').NextConfig} */
// Serwist's default mode is webpack-only (see serwist/serwist#54). The
// asymmetric export below keeps both bundlers happy:
//   - `pnpm dev`   -> Turbopack. nextConfig is exported bare; @serwist/next
//                     isn't even require()d, so no webpack hook is injected
//                     AND no Serwist Turbopack-warning is emitted.
//   - `pnpm build` -> webpack (via the --webpack flag in the build script).
//                     NODE_ENV=production triggers the Serwist require+wrap,
//                     which generates public/sw.js for the PWA service worker.
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Proxy Lightning Address resolution to our API route.
      // External wallets GET /.well-known/lnurlp/<username> per the LNURL-pay spec.
      {
        source: '/.well-known/lnurlp/:username',
        destination: '/api/lnurlp/:username',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  // Prevent webpack from trying to bundle the Breez SDK WASM module.
  // It must load natively via Node.js require() on the server.
  serverExternalPackages: ['@breeztech/breez-sdk-liquid'],
};

if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withSerwist = require('@serwist/next').default({
    swSrc: 'src/app/sw.ts',
    swDest: 'public/sw.js',
  });
  module.exports = withSerwist(nextConfig);
} else {
  module.exports = nextConfig;
}
