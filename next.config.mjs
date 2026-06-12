const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/monapad";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  webpack(config) {
    config.module.rules.push({
      test: /src[\\/]site[\\/]template\.html$/,
      type: "asset/source",
    });

    return config;
  },
  ...(basePath
    ? {
        basePath,
      }
    : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
