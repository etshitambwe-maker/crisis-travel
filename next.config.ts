import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack désactivé — bug de résolution avec les chemins contenant des espaces

  // @react-pdf/renderer embarque un reconciler natif que le bundler serveur
  // (Turbopack/Webpack) corrompt s'il est inliné — il faut le charger en
  // require Node natif. Sans cela, renderToBuffer() lève au runtime serveur :
  // "Cannot read properties of undefined (reading 'S')" → 500 sur /api/export-pdf.
  // (PDF-DEBUG-P0 — bug invisible aux tests Node, présent uniquement en runtime Next.)
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
