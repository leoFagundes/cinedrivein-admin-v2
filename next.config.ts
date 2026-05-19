import type { NextConfig } from "next";
import fs from "fs";

const appVersion = fs.readFileSync("./version.txt", "utf-8").trim();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  // Generates a fully static export compatible with shared hosting (cPanel/Apache)
  output: "export",

  // Each route becomes /route/index.html — works correctly with Apache DirectoryIndex
  trailingSlash: true,

  // next/image requires a server for optimization; use unoptimized for static hosting
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
