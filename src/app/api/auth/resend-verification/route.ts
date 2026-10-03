import { sendVerificationEmail } from "@/lib/account";
import { error, json, withUser } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";

/** Renvoie le lien de confirmation : à la nouvelle adresse demandée s'il y en a une, sinon à l'adresse actuelle. */
export const POST = withUser(async (user) => {
  const email = user.pendingEmail ?? (user.emailVerifiedAt ? null : user.email);
  if (!email) return error("Ton adresse e-mail est déjà confirmée");
  if (await rateLimited("resend-verification", 3, 60 * 60 * 1000, user.id)) return error("Lien déjà renvoyé plusieurs fois, réessaie dans une heure", 429);
  if (!(await sendVerificationEmail(user, email))) return error("L'e-mail n'a pas pu être envoyé, réessaie dans quelques minutes.", 502);
  return json({ ok: true, email });
});
