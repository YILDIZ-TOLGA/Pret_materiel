import type { Plan } from "@prisma/client";

export type PlanInfo = {
  id: Plan;
  name: string;
  maxLoans: number;
  priceCents: number;
  interval: "month" | "year" | null;
  priceLabel: string;
  tagline: string;
};

// Toute la grille tarifaire est ici : modifie ces valeurs pour changer les offres.
export const PLANS: Record<Plan, PlanInfo> = {
  FREE: { id: "FREE", name: "Gratuit", maxLoans: 1, priceCents: 0, interval: null, priceLabel: "0 €", tagline: "1 prêt en cours" },
  MONTHLY: { id: "MONTHLY", name: "Mensuel", maxLoans: 10, priceCents: 200, interval: "month", priceLabel: "2 € / mois", tagline: "10 prêts, sans engagement" },
  YEARLY_10: { id: "YEARLY_10", name: "Annuel 10", maxLoans: 10, priceCents: 1200, interval: "year", priceLabel: "12 € / an", tagline: "10 prêts, 1 € par mois" },
  YEARLY_20: { id: "YEARLY_20", name: "Annuel 20", maxLoans: 20, priceCents: 2400, interval: "year", priceLabel: "24 € / an", tagline: "20 prêts" },
};

export const PAID_PLANS = ["MONTHLY", "YEARLY_10", "YEARLY_20"] as const;

/** Plan réellement actif (un abonnement expiré retombe en gratuit). */
export function effectivePlan(user: { plan: Plan; planExpiresAt: Date | null }): Plan {
  if (user.plan === "FREE") return "FREE";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return "FREE";
  return user.plan;
}

export function maxLoans(user: { plan: Plan; planExpiresAt: Date | null }) {
  return PLANS[effectivePlan(user)].maxLoans;
}

export function stripePriceId(plan: Plan): string | undefined {
  return {
    FREE: undefined,
    MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
    YEARLY_10: process.env.STRIPE_PRICE_YEARLY_10,
    YEARLY_20: process.env.STRIPE_PRICE_YEARLY_20,
  }[plan] || undefined;
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const p of PAID_PLANS) if (stripePriceId(p) === priceId) return p;
  return null;
}
