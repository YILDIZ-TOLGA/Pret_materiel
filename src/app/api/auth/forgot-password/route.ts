import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/account";
import { error, json, zodError } from "@/lib/api";
import { rateLimited } from "@/lib/ratelimit";

const schema = z.object({ email: z.string().trim().toLowerCase().email("E-mail invalide") });

/** Envoie un lien de réinitialisation. La réponse est la même que le compte existe ou non. */
export async function POST(req: Request) {
  if (await rateLimited("forgot-password", 5, 60 * 60 * 1000)) return error("Trop de demandes, réessaie dans une heure", 429);
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const { email } = parsed.data;
  // Pas plus de 3 e-mails par heure vers une même adresse, quelle que soit l'IP
  if (!(await rateLimited("forgot-password-email", 3, 60 * 60 * 1000, email))) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && !user.disabled) await sendPasswordResetEmail(user);
  }
  return json({ ok: true });
}
