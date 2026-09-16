import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pg', 'argon2', '@aws-sdk/client-s3'],
  outputFileTracingIncludes: {
    "/api/documents": ["./public/blontix-logo-v1.png", "./node_modules/@ibm/plex/IBM-Plex-Sans-Arabic/fonts/complete/woff/IBMPlexSansArabic-{Regular,SemiBold}.woff"],
  },
  async headers() {
    return [{
      source: "/verify/:token",
      headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'" },
      ],
    }];
  },
};

export default nextConfig;
