import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      // Allows uploading files up to 50 MB (plus a small overhead for form metadata)
      bodySizeLimit: '52mb',
    },
  },
};

module.exports = withNextIntl(nextConfig);
