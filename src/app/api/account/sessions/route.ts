import { prisma } from "@/lib/db";
import { endOtherSessions } from "@/lib/auth";
import { json, withUser } from "@/lib/api";

/** Nombre d'appareils connectés au compte. */
export const GET = withUser(async (user) => {
  const count = await prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } });
  return json({ count });
});

/** Déconnecte tous les autres appareils (cet appareil reste connecté). */
export const DELETE = withUser(async (user) => {
  await endOtherSessions(user.id, true);
  return json({ ok: true });
});
