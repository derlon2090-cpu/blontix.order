import type { NextConfig } from "next";
import path from 'node:path';
import {deploymentRole,backendOrigin} from './lib/deployment.mjs';

const nextConfig: NextConfig = {
  // Resolve application imports explicitly in Node/webpack deployments.
  webpack(config) {
    config.resolve ??= {};
    config.resolve.alias = {...config.resolve.alias, '@':path.resolve(process.cwd())};
    return config;
  },
  // Only the deployment role is embedded; backend secrets are never bundled.
  env: {APP_ROLE:deploymentRole()},
  async rewrites() {
    return {beforeFiles:deploymentRole()==='frontend' ? [{source:'/api/:path*',destination:`${backendOrigin()}/api/:path*`}] : [],afterFiles:[],fallback:[]};
  },
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
