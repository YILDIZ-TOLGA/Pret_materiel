import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenKind, User } from "@prisma/client";
import { prisma } from "./db";
import { LEGAL, RETENTION } from "./legal";
import { sendMail } from "./mail";
import { stripe } from "./stripe";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

const TTL_HOURS: Record<AuthTokenKind, number> = {
  VERIFY_EMAIL: RETENTION.verifyEmailLinkHours,
  RESET_PASSWORD: RETENTION.resetPasswordLinkHours,
};

/** Crée un lien à usage unique (remplace le précédent du même type) et renvoie le jeton en clair, à mettre dans l'e-mail. */
async function newAuthToken(userId: string, kind: AuthTokenKind, email: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, kind } }),
    prisma.authToken.create({ data: { userId, kind, email, tokenHash: hash(token), expiresAt: new Date(Date.now() + TTL_HOURS[kind] * 3600000) } }),
  ]);
  return token;
}

/** Consomme un lien : renvoie le jeton (et son compte) s'il est valide, puis le supprime. */
export async function consumeAuthToken(token: string, kind: AuthTokenKind) {
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!row || row.kind !== kind) return null;
  await prisma.authToken.delete({ where: { id: row.id } });
  if (row.expiresAt < new Date() || row.user.disabled) return null;
  return row;
}

/** Lien de confirmation, envoyé à l'adresse actuelle (inscription) ou à la nouvelle adresse demandée. */
export async function sendVerificationEmail(user: User, email: string) {
  const token = await newAuthToken(user.id, "VERIFY_EMAIL", email);
  const change = email !== user.email;
  return sendMail({
    to: email,
    kind: "verify_email",
    subject: change ? "Confirme ta nouvelle adresse e-mail" : "Confirme ton adresse e-mail",
    title: `Bonjour ${user.name},`,
    paragraphs: [
      change
        ? "Tu as demandé à utiliser cette adresse pour ton compte Prêt Matériel. Confirme-la avec le bouton ci-dessous."
        : "Bienvenue sur Prêt Matériel. Confirme ton adresse e-mail pour pouvoir enregistrer des prêts et voir ce qu'on t'a prêté.",
      `Ce lien est valable ${RETENTION.verifyEmailLinkHours} heures.`,
      "Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : rien ne sera fait.",
    ],
    cta: { label: "Confirmer mon adresse", url: `${appUrl()}/verifier-email?t=${token}` },
  });
}

export async function sendPasswordResetEmail(user: User) {
  const token = await newAuthToken(user.id, "RESET_PASSWORD", user.email);
  return sendMail({
    to: user.email,
    kind: "reset_password",
    subject: "Choisis un nouveau mot de passe",
    title: `Bonjour ${user.name},`,
    paragraphs: [
      "Tu as demandé à réinitialiser le mot de passe de ton compte Prêt Matériel.",
      `Ce lien est valable ${RETENTION.resetPasswordLinkHours} heure et ne peut servir qu'une fois.`,
      "Si tu n'es pas à l'origine de cette demande, ignore cet e-mail : ton mot de passe actuel reste valable.",
    ],
    cta: { label: "Choisir un nouveau mot de passe", url: `${appUrl()}/reinitialiser-mot-de-passe?t=${token}` },
  });
}

/** Prévient le titulaire d'une modification sensible (mot de passe, adresse e-mail). */
export function sendSecurityNotice(to: string, name: string, subject: string, what: string) {
  return sendMail({
    to,
    kind: "security_notice",
    subject,
    title: `Bonjour ${name},`,
    paragraphs: [what, `Si ce n'est pas toi, réinitialise ton mot de passe tout de suite et écris-nous à ${LEGAL.editor.email}.`],
    cta: { label: "Réinitialiser mon mot de passe", url: `${appUrl()}/mot-de-passe-oublie` },
  });
}

/**
 * L'adresse `email` est confirmée pour ce compte : elle devient son adresse, et les prêts faits à
 * cette adresse lui sont rattachés. Renvoie null si l'adresse a été prise entre-temps par un autre compte.
 */
export async function confirmEmail(user: User, email: string) {
  const taken = await prisma.user.findFirst({ where: { email, id: { not: user.id } }, select: { id: true } });
  if (taken) return null;
  // Le compte admin désigné par ADMIN_EMAIL n'est accordé qu'une fois l'adresse prouvée
  const isAdmin = !!process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase();
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { email, emailVerifiedAt: new Date(), pendingEmail: null, ...(isAdmin ? { role: "ADMIN" as const } : {}) },
    }),
    prisma.loan.updateMany({ where: { borrowerEmail: email, borrowerId: null, lenderId: { not: user.id } }, data: { borrowerId: user.id } }),
  ]);
  if (email !== user.email && user.stripeCustomerId && stripe) {
    await stripe.customers.update(user.stripeCustomerId, { email }).catch((e) => console.error("Stripe : e-mail client non mis à jour", e));
  }
  return updated;
}
