import type { NextConfig } from "next";

const selfHosted = process.env.MATHORA_SELF_HOSTED === "1";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  ...(selfHosted
    ? {
        basePath: "/thuviendethi",
        output: "standalone" as const,
      }
    : {}),
};

export default nextConfig;
