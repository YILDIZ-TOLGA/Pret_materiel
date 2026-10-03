import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendSecurityNotice } from "@/lib/account";
import { endOtherSessions, hashPassword, verifyPassword } from "@/lib/auth";
import { error, json, withUser, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ current: z.string().min(1, "Mot de passe actuel requis"), password: passwordSchema });

/** Changement de mot de passe : les autres appareils sont déconnectés, celui-ci reste connecté. */
export const POST = withUser(async (user, req) => {
  if (await rateLimited("change-password", 10, 15 * 60 * 1000, user.id)) return error("Trop de tentatives, réessaie dans 15 minutes", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return error("Mot de passe actuel incorrect", 403);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await endOtherSessions(user.id, true);
  await sendSecurityNotice(user.email, user.name, "Ton mot de passe a été modifié",
    "Le mot de passe de ton compte Prêt Matériel vient d'être modifié. Tes autres appareils ont été déconnectés.");
  return json({ ok: true });
});
