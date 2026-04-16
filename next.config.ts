import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allows uploading files up to 50 MB (plus a small overhead for form metadata)
      bodySizeLimit: '52mb',
    },
  },
  images: {
    remotePatterns: [
      {
        // Allow avatar images served from any Supabase project's storage
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
