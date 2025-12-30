import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'export',
  basePath: '', // Empty for subdomain deployment
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
