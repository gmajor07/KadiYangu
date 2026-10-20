import type { NextConfig } from "next";
const r2PublicUrl = process.env.R2_PUBLIC_BASE_URL;
const r2ImagePattern = (() => {
  if (!r2PublicUrl) return undefined;
  try {
    const url = new URL(r2PublicUrl);
    return { protocol: url.protocol.replace(":", "") as "http" | "https", hostname: url.hostname, port: url.port, pathname: "/**" };
  } catch {
    return undefined;
  }
})();
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Browser tests use their own public origin and build artifacts.
  distDir: process.env.KADI_TEST_BUILD === "true" ? ".next-test" : ".next",
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  images: { remotePatterns: r2ImagePattern ? [r2ImagePattern] : [] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.SITE_INDEXABLE !== "true"
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
      {
        source: "/dashboard/invitations/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};
export default config;
