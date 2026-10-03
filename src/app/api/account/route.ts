import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSessionCookie, publicUser, verifyPassword } from "@/lib/auth";
import { error, json, withUser, zodError } from "@/lib/api";
import { stripe } from "@/lib/stripe";

const patchSchema = z.object({ name: z.string().trim().min(1, "Prénom requis").max(80) });

/** Droit de rectification (art. 16 RGPD). */
export const PATCH = withUser(async (user, req) => {
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const updated = await prisma.user.update({ where: { id: user.id }, data: parsed.data });
  return json({ user: publicUser(updated) });
});

const deleteSchema = z.object({ password: z.string().min(1, "Mot de passe requis") });

/**
 * Droit à l'effacement (art. 17 RGPD) : supprime le compte, ses prêts et notifications (cascade).
 * Les paiements sont conservés sans lien avec le compte (obligation comptable, 10 ans).
 */
export const DELETE = withUser(async (user, req) => {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return error("Mot de passe incorrect", 403);
  if (user.role === "ADMIN" && (await prisma.user.count({ where: { role: "ADMIN" } })) <= 1) {
    return error("Tu es le seul administrateur : nomme un autre admin avant de supprimer ton compte");
  }

  if (stripe && user.stripeCustomerId) {
    // Supprimer le client Stripe annule immédiatement l'abonnement : plus aucun prélèvement.
    try { await stripe.customers.del(user.stripeCustomerId); }
    catch (e) {
      console.error("Suppression client Stripe", e);
      return error("Impossible d'annuler l'abonnement pour le moment, réessaie dans quelques minutes", 502);
    }
  }
  await prisma.user.delete({ where: { id: user.id } });
  await clearSessionCookie();
  return json({ ok: true });
});
