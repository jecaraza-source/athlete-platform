import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// Derive the exact Supabase storage hostname from the project URL env var.
// Falls back to a wildcard pattern only during local build if the var is unset.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname          // e.g. gwjnqokwchdojlcngtbi.supabase.co
  : '*.supabase.co';                       // fallback for bare builds without env

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allows uploading files up to 50 MB (plus a small overhead for form metadata)
      bodySizeLimit: '52mb',
    },
  },

  // ---------------------------------------------------------------------------
  // HTTP Security Headers
  // Applied to every response. CSP is intentionally omitted here because
  // Next.js App Router requires 'unsafe-inline' for hydration; a nonce-based
  // CSP should be added as a follow-up via middleware once the policy is tuned.
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent this site from being embedded in an iframe (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Force HTTPS for 2 years, including subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Limit referrer information sent to third-party origins
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict access to sensitive browser APIs
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        // Restrict to this project's Supabase storage bucket only.
        // The hostname is derived from NEXT_PUBLIC_SUPABASE_URL at build time.
        protocol: 'https',
        hostname: supabaseHostname,
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
