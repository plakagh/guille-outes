import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle. `app/Dockerfile` ships only this tree
  // plus the static assets, which is what keeps the production image small
  // enough to be worth pulling on every deploy.
  output: "standalone",

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://sis.redsys.es https://sis-t.redsys.es:25443",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
