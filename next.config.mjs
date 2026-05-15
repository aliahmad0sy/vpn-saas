/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a minimal server bundle at .next/standalone for Docker prod images.
  output: 'standalone',
  // ssh2 ships a native binding (sshcrypto.node) — Next's webpack can't
  // bundle .node files. Mark it external so it's loaded from node_modules
  // at runtime instead. Also keep prisma + bcryptjs external for the
  // standalone build so their native pieces resolve correctly.
  serverExternalPackages: ['ssh2', '@prisma/client', 'bcryptjs'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
