import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";

const key = () => process.env.JWT_SECRET || "dev-secret-change-me";

/** Jeton signé qui autorise la désinscription d'une adresse sans être connecté. */
export const optOutToken = (email: string) => createHmac("sha256", key()).update(`optout:${email.toLowerCase()}`).digest("base64url");

export function checkOptOutToken(email: string, token: string) {
  const a = Buffer.from(optOutToken(email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function optOutUrl(email: string) {
  const base = process.env.APP_URL || "http://localhost:3000";
  return `${base}/desinscription?e=${encodeURIComponent(email)}&t=${optOutToken(email)}`;
}

export async function isOptedOut(email: string) {
  return !!(await prisma.emailOptOut.findUnique({ where: { email: email.toLowerCase() } }));
}
