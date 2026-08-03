import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["knex", "mysql2"],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

