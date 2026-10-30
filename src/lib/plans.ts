import type { Plan } from "@prisma/client";

export type Interval = "month" | "year";

export type PlanInfo = {
  id: Plan;
  name: string;
  maxLoans: number;
  // anti-abus : nouveaux prêts par 24 h, donc demandes de signature envoyées à des tiers (écrit dans les CGU)
  maxNewLoansPerDay: number;
  // prix hors taxes (clients professionnels), en centimes
  priceCents: number;
  interval: Interval | null;
  priceLabel: string;
};

const price = (cents: number, interval: Interval | null) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0 })} € HT${interval ? ` / ${interval === "month" ? "mois" : "an"}` : ""}`;

const plan = (id: Plan, name: string, maxLoans: number, maxNewLoansPerDay: number, priceCents: number, interval: Interval | null): PlanInfo =>
  ({ id, name, maxLoans, maxNewLoansPerDay, priceCents, interval, priceLabel: price(priceCents, interval) });

// Toute la grille tarifaire est ici : une seule offre payante, l'offre Entreprise, vendue à l'année à des
// professionnels (prix hors taxes). Sans abonnement (FREE), les prêts existants restent consultables et
// modifiables mais on ne peut plus en créer, sauf pendant la phase de test (BETA_LIMITS, src/lib/limits.ts).
// Pour ouvrir une offre d'essai gratuite, il suffit de donner des prêts en cours à FREE.
// Ajouter ou retirer une offre demande aussi de modifier l'enum Plan dans prisma/schema.prisma.
// plan(id, nom, prêts en cours, nouveaux prêts par jour, prix HT en centimes, période)
export const PLANS: Record<Plan, PlanInfo> = {
  FREE: plan("FREE", "Sans abonnement", 0, 0, 0, null),
  ENTREPRISE_YEARLY: plan("ENTREPRISE_YEARLY", "Entreprise", 1000, 200, 29900, "year"),
};

export const PAID_PLANS = ["ENTREPRISE_YEARLY"] as const;

/** L'offre vendue, présentée sur l'accueil et la page Offre. */
export const MAIN_PLAN = PLANS.ENTREPRISE_YEARLY;

/** Plan réellement actif (un abonnement expiré retombe sans abonnement). */
export function effectivePlan(user: { plan: Plan; planExpiresAt: Date | null }): Plan {
  if (user.plan === "FREE") return "FREE";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return "FREE";
  return user.plan;
}

// Limites d'un utilisateur : toujours via limitsFor() (src/lib/sitemode.ts), qui tient compte du mode du site.

export function stripePriceId(plan: Plan): string | undefined {
  return {
    FREE: undefined,
    ENTREPRISE_YEARLY: process.env.STRIPE_PRICE_ENTREPRISE_YEARLY,
  }[plan] || undefined;
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const p of PAID_PLANS) if (stripePriceId(p) === priceId) return p;
  return null;
}
