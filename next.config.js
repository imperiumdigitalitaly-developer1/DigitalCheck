/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "*": ["./node_modules/pg-cloudflare/dist/**/*"],
  },
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  // Le chiamate esterne (crawler, AI provider, PageSpeed) avvengono
  // esclusivamente lato server (route handlers / server actions):
  // nessuna API key raggiunge mai il bundle client.
};

module.exports = nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
