import { z } from "zod";
import { prisma } from "@/lib/db";
import { createToken, publicUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { error, json, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().trim().toLowerCase().email("E-mail invalide"), password: z.string().min(1) });

export async function POST(req: Request) {
  if (await rateLimited("login", 10, 15 * 60 * 1000)) return error("Trop de tentatives, réessaie dans 15 minutes", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) return error("E-mail ou mot de passe incorrect", 401);
  if (user.disabled) return error("Compte désactivé", 403);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), inactivityNoticeAt: null } });
  const token = await createToken(user.id);
  await setSessionCookie(token);
  return json({ user: publicUser(user), token });
}
