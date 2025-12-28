import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "export",
  images: {
    unoptimized: true,
  },
};

const withMDX = createMDX({
  configPath: "source.config.ts",
});

export default withMDX(config);
