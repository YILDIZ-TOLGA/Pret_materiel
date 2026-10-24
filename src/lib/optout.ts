import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "./db";

const key = () => process.env.JWT_SECRET || "dev-secret-change-me";
const aesKey = () => createHash("sha256").update(`optout-aes:${key()}`).digest();

/**
 * Jeton de désinscription : l'adresse e-mail chiffrée (AES-256-GCM, donc aussi authentifiée).
 * L'adresse n'apparaît jamais en clair dans le lien, ni dans l'historique du navigateur ni dans les
 * journaux du serveur ou du reverse proxy (pas de donnée personnelle dans les URL).
 */
export function optOutToken(email: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey(), iv);
  const data = Buffer.concat([cipher.update(email.toLowerCase(), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Adresse désignée par un jeton, ou null s'il est invalide ou falsifié. */
export function emailFromOptOutToken(token: string) {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", aesKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Ancien format de lien (adresse en clair + signature), encore accepté pour les e-mails déjà envoyés. */
export function checkLegacyOptOutToken(email: string, token: string) {
  const a = Buffer.from(createHmac("sha256", key()).update(`optout:${email.toLowerCase()}`).digest("base64url"));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const base = () => process.env.APP_URL || "http://localhost:3000";
/** Page de désinscription (lien en bas des e-mails). */
export const optOutUrl = (email: string) => `${base()}/desinscription?t=${optOutToken(email)}`;
/** Désinscription en un clic depuis le client mail (en-tête List-Unsubscribe, RFC 8058). */
export const optOutApiUrl = (email: string) => `${base()}/api/optout?t=${optOutToken(email)}`;

/** « j•••@gmail.com » : pour montrer quelle adresse est concernée sans l'afficher en entier. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 1)}•••@${domain}`;
}

export async function isOptedOut(email: string) {
  return !!(await prisma.emailOptOut.findUnique({ where: { email: email.toLowerCase() } }));
}
