const dev = process.env.NODE_ENV !== "production";

// Politique de sécurité du contenu : tout vient du site lui-même (polices auto-hébergées, aucun script tiers).
// Next.js injecte des scripts en ligne pour l'hydratation, d'où 'unsafe-inline' ; 'unsafe-eval' seulement en dev.
// Le paiement Stripe se fait par redirection (pas d'iframe ni de script Stripe sur nos pages).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // interdit l'affichage du site dans une iframe d'un autre site (clickjacking)
  "frame-ancestors 'none'",
].join("; ");

// HSTS est ajouté par Caddy en production (Caddyfile), pour ne pas forcer le HTTPS sur http://localhost.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dossier de build séparé possible (deux serveurs de dev en parallèle) : NEXT_DIST_DIR=.next-autre
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
