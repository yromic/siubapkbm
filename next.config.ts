// Trigger dev server restart for clean compilation context: 1721496000
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['knex', 'mysql2']
};

export default nextConfig;
