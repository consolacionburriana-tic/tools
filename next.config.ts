import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AUTOASM usa SSH nativo vía ssh2; deja que Node cargue la extensión .node en runtime.
  serverExternalPackages: ['ssh2-sftp-client'],
};

export default nextConfig;
