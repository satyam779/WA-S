import path from 'node:path';
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const config: NextConfig = {
  poweredByHeader: false,
  // Reuse dashboard pages visited in the last 30s when navigating back; actions still refresh them.
  experimental: { staleTimes: { dynamic: 30 } },
  transpilePackages: ['@wa/shared', '@wa/billing', '@wa/meta', '@wa/db'],
  // Monorepo: trace files from the repo root, and ship Prisma's Linux engine with the server functions.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  outputFileTracingIncludes: {
    '/**': ['../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/{schema.prisma,libquery_engine-rhel-openssl-3.0.x.so.node}'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default config;
