/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "pdf-parse"],
  },
  // Serve .mjs files from /public with the correct MIME type
  async headers() {
    return [
      {
        source: "/:file*.mjs",
        headers: [
          { key: "Content-Type", value: "text/javascript" },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

export default nextConfig;
