import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/account";
import { publicUser, verifyPassword } from "@/lib/auth";
import { error, json, withUser, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

/** Demande de changement d'adresse : rien ne change tant que la nouvelle adresse n'est pas confirmée par le lien. */
export const POST = withUser(async (user, req) => {
  if (await rateLimited("change-email", 10, 60 * 60 * 1000, user.id)) return error("Trop de demandes, réessaie dans une heure", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const { email, password } = parsed.data;
  if (!(await verifyPassword(password, user.passwordHash))) return error("Mot de passe incorrect", 403);
  if (email === user.email) return error("C'est déjà ton adresse actuelle");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) return error("Cette adresse est déjà utilisée par un autre compte", 409);

  const updated = await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: email } });
  if (!(await sendVerificationEmail(updated, email))) return error("L'e-mail de confirmation n'a pas pu être envoyé, réessaie dans quelques minutes.", 502);
  return json({ user: publicUser(updated) });
});

/** Annule une demande de changement d'adresse en attente. */
export const DELETE = withUser(async (user) => {
  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { pendingEmail: null } }),
    prisma.authToken.deleteMany({ where: { userId: user.id, kind: "VERIFY_EMAIL", email: { not: user.email } } }),
  ]);
  return json({ user: publicUser(updated) });
});
