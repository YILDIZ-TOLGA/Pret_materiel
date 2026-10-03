import { z } from "zod";
import { prisma } from "@/lib/db";
import { confirmEmail, consumeAuthToken, sendSecurityNotice } from "@/lib/account";
import { hashPassword } from "@/lib/auth";
import { error, json, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";
import { passwordSchema } from "@/lib/validation";

const schema = z.object({ t: z.string().min(20).max(200), password: passwordSchema });

/** Nouveau mot de passe par le lien reçu : toutes les sessions ouvertes sont fermées. */
export async function POST(req: Request) {
  if (await rateLimited("reset-password", 20, 15 * 60 * 1000)) return error("Trop de tentatives, réessaie dans 15 minutes", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const row = await consumeAuthToken(parsed.data.t, "RESET_PASSWORD");
  if (!row || row.email !== row.user.email) return error("Ce lien n'est plus valable : il a déjà servi ou a expiré.", 410);

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  // Le lien est arrivé dans la boîte de l'utilisateur : son adresse est prouvée
  if (!row.user.emailVerifiedAt) await confirmEmail(row.user, row.user.email);
  await sendSecurityNotice(row.user.email, row.user.name, "Ton mot de passe a été modifié",
    "Le mot de passe de ton compte Prêt Matériel vient d'être modifié. Tous tes appareils ont été déconnectés.");
  return json({ ok: true });
}
