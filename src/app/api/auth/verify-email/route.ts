import { z } from "zod";
import { confirmEmail, consumeAuthToken, sendSecurityNotice } from "@/lib/account";
import { publicUser } from "@/lib/auth";
import { error, json, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";

const schema = z.object({ t: z.string().min(20).max(200) });

/** Confirmation d'adresse e-mail par le lien reçu (inscription ou changement d'adresse). */
export async function POST(req: Request) {
  if (await rateLimited("verify-email", 20, 15 * 60 * 1000)) return error("Trop de tentatives, réessaie dans 15 minutes", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const row = await consumeAuthToken(parsed.data.t, "VERIFY_EMAIL");
  // Lien expiré, déjà utilisé, ou remplacé par une demande plus récente
  if (!row || (row.email !== row.user.email && row.email !== row.user.pendingEmail)) {
    return error("Ce lien n'est plus valable. Connecte-toi et demande un nouveau lien depuis l'application.", 410);
  }
  const user = await confirmEmail(row.user, row.email);
  if (!user) return error("Cette adresse est déjà utilisée par un autre compte.", 409);
  if (row.email !== row.user.email) {
    await sendSecurityNotice(row.user.email, user.name, "L'adresse e-mail de ton compte a changé",
      `L'adresse e-mail de ton compte Prêt Matériel est désormais ${user.email}. Cette adresse-ci n'est plus utilisée pour ton compte.`);
  }
  return json({ user: publicUser(user) });
}
