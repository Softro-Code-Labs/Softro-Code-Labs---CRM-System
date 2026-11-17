import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
