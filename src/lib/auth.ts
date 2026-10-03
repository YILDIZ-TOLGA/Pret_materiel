import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { RETENTION } from "./legal";

export const SESSION_COOKIE = "session";
const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET manquant");
  return new TextEncoder().encode(s || "dev-secret-change-me");
};

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

const SESSION_DAYS = RETENTION.sessionDays;

/** Ouvre une session (une ligne en base par appareil) et renvoie le jeton qui la désigne. */
export async function createToken(userId: string) {
  const session = await prisma.session.create({ data: { userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } });
  return new SignJWT({ sid: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

/** Lit le jeton de la requête (cookie ou Bearer) et renvoie la session qu'il désigne, si elle existe encore. */
async function currentSession() {
  const auth = (await headers()).get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.sid !== "string") return null;
    const session = await prisma.session.findUnique({ where: { id: payload.sid }, include: { user: true } });
    if (!session || session.userId !== payload.sub || session.expiresAt < new Date()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Ferme la session de cet appareil (déconnexion). */
export async function endCurrentSession() {
  const session = await currentSession();
  if (session) await prisma.session.deleteMany({ where: { id: session.id } });
}

/** Ferme toutes les sessions d'un utilisateur, sauf éventuellement celle de cet appareil. */
export async function endOtherSessions(userId: string, keepCurrent: boolean) {
  const keep = keepCurrent ? (await currentSession())?.id : undefined;
  await prisma.session.deleteMany({ where: { userId, ...(keep ? { id: { not: keep } } : {}) } });
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // cookie « secure » seulement en HTTPS (sinon la connexion échoue sur http://localhost)
    secure: (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Utilisateur courant : cookie (site web) ou en-tête `Authorization: Bearer <token>`
 * (applis mobiles iOS / Android qui consomment la même API).
 */
export async function getCurrentUser(): Promise<User | null> {
  const user = (await currentSession())?.user;
  return user && !user.disabled ? user : null;
}

export function publicUser(u: User) {
  const { passwordHash: _pw, ...rest } = u;
  return rest;
}
