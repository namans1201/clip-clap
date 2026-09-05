import type { NextConfig } from "next";

/**
 * ── Content-Security-Policy ────────────────────────────────────────────────
 * Tightest CSP that still lets the existing surface area work:
 *
 *   - script-src 'self' is the base. `'unsafe-inline'` covers Next's
 *     hydration scripts; `'wasm-unsafe-eval'` covers mermaid's WASM path.
 *   - `'unsafe-eval'` is added in DEVELOPMENT ONLY because React DevTools
 *     and source-map callstack reconstruction call `eval()` internally.
 *     React's runtime never calls eval() in production builds, so the
 *     production CSP stays strict.
 *   - style-src 'self' 'unsafe-inline' — we inject <style> tags from the
 *     fingerprint sandbox + react-syntax-highlighter themes.
 *   - img-src 'self' data: blob: https://media.giphy.com — the fingerprint
 *     button references a giphy GIF pattern in its <defs>.
 *   - connect-src 'self' https://*.supabase.co wss://*.supabase.co —
 *     Supabase realtime uses WSS.
 *   - frame-ancestors 'none' kills clickjacking.
 *
 * If a future feature breaks under this policy, the browser console will
 * print a CSP violation report with the directive that needs widening.
 */
const isDev = process.env.NODE_ENV !== 'production';

const scriptSrc = [
  "'self'",
  "'wasm-unsafe-eval'",
  "'unsafe-inline'",
  // Dev-only — React reconstruction + DevTools call eval(). Stripped in prod.
  isDev && "'unsafe-eval'",
].filter(Boolean).join(' ');

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://media.giphy.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: csp },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // Performance optimizations
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  compiler: {
    // Strip EVERY console.* call in production builds, including error/warn —
    // previously these were excluded, which leaked full error stacks into
    // DevTools. Errors are reported via toast(); we never want raw stacks
    // visible to end users in prod.
    removeConsole: process.env.NODE_ENV === 'production',
  },

  reactStrictMode: true,

  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },

  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
    ];
  },
};

export default nextConfig;
