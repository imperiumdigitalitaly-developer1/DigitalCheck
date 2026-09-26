// Content-Security-Policy in sola modalita' Report-Only: costruita sull'uso
// reale del bundle client (nessuno script/font/API esterni lato browser —
// Gemini, PageSpeed, Google OAuth, Stripe e Resend vengono chiamati solo dai
// route handler server-side, vedi commento sotto). Report-Only non blocca
// nulla: serve solo a far comparire eventuali violazioni nella console/negli
// strumenti di sviluppo, senza rischio di rompere qualcosa in produzione.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le chiamate esterne (crawler, AI provider, PageSpeed) avvengono
  // esclusivamente lato server (route handlers / server actions):
  // nessuna API key raggiunge mai il bundle client.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

module.exports = nextConfig;
