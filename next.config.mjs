/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // react-pdf / pdfjs-dist: suppress canvas warning in browser bundle
      config.resolve.alias.canvas = false;
    }
    return config;
  },
};

export default nextConfig;
