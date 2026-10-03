/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dossier de build séparé possible (deux serveurs de dev en parallèle) : NEXT_DIST_DIR=.next-autre
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
};
export default nextConfig;
