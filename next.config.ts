import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const onVercel = Boolean(process.env.VERCEL);
// Vercel's comment toolbar only appears on preview deployments.
const vercelLive = process.env.VERCEL_ENV === "preview" ? " https://vercel.live" : "";

/**
 * Content Security Policy: only load code, styles and images from the CRM itself.
 * Next.js needs inline scripts and styles; everything else is locked down.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}${vercelLive}${vercelLive ? " wss://ws-us3.pusher.com" : ""}`,
  `frame-src 'self'${vercelLive}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(onVercel ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  // Profile photos are resized in the browser first; this leaves room for the rare one that can't be.
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // Going back to a page seen in the last 30 seconds shows it instantly from the browser's copy.
    // Saving anything clears that copy (revalidatePath), so people never see their own change missing.
    staleTimes: { dynamic: 30 },
  },
  // The CRM is fully authenticated and per-user, so every page renders at
  // request time. Cache Components is left off to keep data flow simple.
  output: "standalone",
  // Fonts used when drawing quote PDFs on the server.
  outputFileTracingIncludes: {
    "/quotes/[id]/pdf": ["./src/assets/fonts/**/*"],
  },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(onVercel ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
      {
        // Personal data: never cache these responses in shared caches.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
