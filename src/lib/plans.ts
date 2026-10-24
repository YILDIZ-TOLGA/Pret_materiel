import type { Plan } from "@prisma/client";

export type Interval = "month" | "year";
export type TierId = "FREE" | "PERSO" | "PRO50" | "PRO200";

export type PlanInfo = {
  id: Plan;
  tier: TierId;
  name: string;
  maxLoans: number;
  // anti-abus : nouveaux prêts par 24 h, donc e-mails envoyés à des tiers (écrit dans les CGU)
  maxNewLoansPerDay: number;
  priceCents: number;
  interval: Interval | null;
  priceLabel: string;
};

const price = (cents: number, interval: Interval | null) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: cents % 100 ? 2 : 0 })} €${interval ? ` / ${interval === "month" ? "mois" : "an"}` : ""}`;

const plan = (id: Plan, tier: TierId, name: string, maxLoans: number, maxNewLoansPerDay: number, priceCents: number, interval: Interval | null): PlanInfo =>
  ({ id, tier, name, maxLoans, maxNewLoansPerDay, priceCents, interval, priceLabel: price(priceCents, interval) });

// Toute la grille tarifaire est ici : modifie ces valeurs pour changer les offres.
// Deux règles à garder pour que la grille reste cohérente :
//  - le prix d'un prêt baisse quand on monte d'offre (sinon cumuler des petits comptes devient rentable) ;
//  - l'annuel coûte 10 mois (2 mois offerts), pour toutes les offres.
// Ajouter ou retirer une offre demande aussi de modifier l'enum Plan dans prisma/schema.prisma.
// plan(id, offre, nom, prêts en cours, nouveaux prêts par jour, prix en centimes, période)
export const PLANS: Record<Plan, PlanInfo> = {
  FREE: plan("FREE", "FREE", "Gratuit", 3, 30, 0, null),
  PERSO_MONTHLY: plan("PERSO_MONTHLY", "PERSO", "Perso mensuel", 10, 30, 300, "month"),
  PERSO_YEARLY: plan("PERSO_YEARLY", "PERSO", "Perso annuel", 10, 30, 3000, "year"),
  PRO50_MONTHLY: plan("PRO50_MONTHLY", "PRO50", "Pro 50 mensuel", 50, 50, 1200, "month"),
  PRO50_YEARLY: plan("PRO50_YEARLY", "PRO50", "Pro 50 annuel", 50, 50, 12000, "year"),
  PRO200_MONTHLY: plan("PRO200_MONTHLY", "PRO200", "Pro 200 mensuel", 200, 200, 2400, "month"),
  PRO200_YEARLY: plan("PRO200_YEARLY", "PRO200", "Pro 200 annuel", 200, 200, 24000, "year"),
};

export const PAID_PLANS = ["PERSO_MONTHLY", "PERSO_YEARLY", "PRO50_MONTHLY", "PRO50_YEARLY", "PRO200_MONTHLY", "PRO200_YEARLY"] as const;

/** Prix mensuel le plus bas, pour les « dès … par mois » des pages. */
export const FROM_MONTHLY_CENTS = Math.min(...PAID_PLANS.filter((p) => PLANS[p].interval === "month").map((p) => PLANS[p].priceCents));

/** Offres payantes regroupées pour l'affichage : une carte par offre, avec une bascule mensuel / annuel. */
export const TIERS = [
  { id: "PERSO", name: "Perso", audience: "Pour un usage personnel", month: "PERSO_MONTHLY", year: "PERSO_YEARLY", pro: false },
  { id: "PRO50", name: "Pro 50", audience: "Entreprises, associations, écoles", month: "PRO50_MONTHLY", year: "PRO50_YEARLY", pro: true },
  { id: "PRO200", name: "Pro 200", audience: "Entreprises, associations, écoles", month: "PRO200_MONTHLY", year: "PRO200_YEARLY", pro: true },
] as const satisfies readonly { id: TierId; name: string; audience: string; month: Plan; year: Plan; pro: boolean }[];

export type Tier = (typeof TIERS)[number];

export const isProPlan = (p: Plan) => PLANS[p].tier === "PRO50" || PLANS[p].tier === "PRO200";

/** Remise de l'annuel par rapport à 12 mensualités, calculée depuis les prix (jamais écrite à la main). */
export function yearlySaving(tier: Tier) {
  const month = PLANS[tier.month].priceCents, year = PLANS[tier.year].priceCents;
  const free = 12 - year / month;
  if (free <= 0) return null;
  return Number.isInteger(free) ? `${free} mois offerts` : `−${Math.round((1 - year / (12 * month)) * 100)} %`;
}

/** Remise affichée sur la bascule mensuel / annuel, seulement si elle est la même pour toutes les offres. */
export function commonYearlySaving() {
  const all = new Set(TIERS.map(yearlySaving));
  return all.size === 1 ? [...all][0] : null;
}

/** Plan réellement actif (un abonnement expiré retombe en gratuit). */
export function effectivePlan(user: { plan: Plan; planExpiresAt: Date | null }): Plan {
  if (user.plan === "FREE") return "FREE";
  if (user.planExpiresAt && user.planExpiresAt.getTime() < Date.now()) return "FREE";
  return user.plan;
}

export function maxLoans(user: { plan: Plan; planExpiresAt: Date | null }) {
  return PLANS[effectivePlan(user)].maxLoans;
}

export function maxNewLoansPerDay(user: { plan: Plan; planExpiresAt: Date | null }) {
  return PLANS[effectivePlan(user)].maxNewLoansPerDay;
}

export function stripePriceId(plan: Plan): string | undefined {
  return {
    FREE: undefined,
    PERSO_MONTHLY: process.env.STRIPE_PRICE_PERSO_MONTHLY,
    PERSO_YEARLY: process.env.STRIPE_PRICE_PERSO_YEARLY,
    PRO50_MONTHLY: process.env.STRIPE_PRICE_PRO50_MONTHLY,
    PRO50_YEARLY: process.env.STRIPE_PRICE_PRO50_YEARLY,
    PRO200_MONTHLY: process.env.STRIPE_PRICE_PRO200_MONTHLY,
    PRO200_YEARLY: process.env.STRIPE_PRICE_PRO200_YEARLY,
  }[plan] || undefined;
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const p of PAID_PLANS) if (stripePriceId(p) === priceId) return p;
  return null;
}
