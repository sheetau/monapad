const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/monapad";

const nextConfig = {
  output: "export",
  trailingSlash: true,
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
