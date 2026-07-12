import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['knex', 'mysql2']
};

export default nextConfig;
