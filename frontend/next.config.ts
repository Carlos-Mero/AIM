import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable rewrites to proxy API requests to backend server
  output: 'export',
};

export default nextConfig;
