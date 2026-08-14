import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle. `app/Dockerfile` ships only this tree
  // plus the static assets, which is what keeps the production image small
  // enough to be worth pulling on every deploy.
  output: "standalone",

  experimental: {
    // Both image uploads — admin product photos and gallery drawings — hand the
    // file to a Server Action inside a FormData, and Next caps an action's
    // request body at 1 MB. That cap is enforced while the body is still being
    // read, so it fires *before* the action runs: the `too_large` message the
    // actions carefully return was unreachable, and any real photograph got
    // ApiError(413) / E394 and Next's own error page instead.
    //
    // Set above the 8 MB that uploadProductImage, publishArtwork and the storage
    // bucket all enforce, so that the app's own check is the one a too-big file
    // meets. The extra megabyte is headroom for what multipart adds on top of
    // the file: boundaries, part headers, and the other form fields.
    serverActions: {
      bodySizeLimit: "9mb",
    },
  },

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
