import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@athlete-platform/shared'],
  experimental: {
    serverActions: {
      // Allows uploading files up to 50 MB (plus a small overhead for form metadata)
      bodySizeLimit: '52mb',
    },
  },
};

export default withNextIntl(nextConfig);
