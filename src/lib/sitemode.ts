import type { SiteMode, User } from "@prisma/client";
import { prisma } from "./db";
import { LEGAL } from "./legal";
import { BETA_LIMITS, PAID_NOTICE_DAYS } from "./limits";
import { sendMail } from "./mail";
import { FROM_MONTHLY_CENTS, PLANS, effectivePlan, type PlanInfo } from "./plans";

/**
 * Mode du site, choisi dans l'admin (page Mode du site) :
 *  - BETA, « site testeur » : tout est gratuit, aucune offre n'est vendue, limites larges ci-dessous ;
 *  - PAID, « site payant » : offres et limites de src/lib/plans.ts.
 * Le passage au payant est programmé au moins PAID_NOTICE_DAYS jours à l'avance (CGU art. 10) et annoncé
 * par e-mail ; il ne supprime rien : au-delà de l'offre gratuite, les prêts restent consultables et
 * modifiables, seule la création (ou la réouverture) demande une offre payante.
 */
export { BETA_LIMITS, PAID_NOTICE_DAYS };
const DAY = 86400000;
const appUrl = () => process.env.APP_URL || "http://localhost:3000";
// (pas d'import de loans.ts, qui importe ce fichier : notification et date écrites ici)
const fmtDate = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const notify = (userId: string, title: string, body: string, link: string) => prisma.notification.create({ data: { userId, title, body, link } });
export const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ

/** Minuit, heure de Paris, du jour « AAAA-MM-JJ » (heure d'été comprise). */
export function parisMidnight(day: string) {
  const utc = new Date(`${day}T00:00:00Z`);
  const offset = new Date(utc.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() - new Date(utc.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(utc.getTime() - offset);
}

/** La ligne de réglages (créée si besoin : la migration l'ajoute déjà). */
export async function siteSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  if (row) return row;
  return prisma.siteSetting.create({ data: { id: 1 } }).catch(() => prisma.siteSetting.findUniqueOrThrow({ where: { id: 1 } }));
}

/** Mode réellement en vigueur : un passage au payant programmé s'applique dès sa date, avant même la tâche planifiée. */
export async function siteState(now = new Date()): Promise<{ mode: SiteMode; paidFrom: Date | null }> {
  const s = await siteSettings();
  const paid = s.mode === "PAID" || (!!s.paidFrom && s.paidFrom <= now);
  return { mode: paid ? "PAID" : "BETA", paidFrom: paid ? null : s.paidFrom };
}

/** Limites d'un utilisateur selon le mode du site et son offre (en phase de test : la plus large des deux). */
export async function limitsFor(user: Pick<User, "plan" | "planExpiresAt">) {
  const plan: PlanInfo = PLANS[effectivePlan(user)];
  const { mode, paidFrom } = await siteState();
  if (mode === "PAID") return { mode, paidFrom, plan, maxLoans: plan.maxLoans, maxNewLoansPerDay: plan.maxNewLoansPerDay };
  return {
    mode, paidFrom, plan,
    maxLoans: Math.max(plan.maxLoans, BETA_LIMITS.maxLoans),
    maxNewLoansPerDay: Math.max(plan.maxNewLoansPerDay, BETA_LIMITS.maxNewLoansPerDay),
  };
}

/** Premier jour possible pour le passage au payant (« AAAA-MM-JJ », préavis de 30 jours). */
export const earliestPaidDay = (now = new Date()) => parisDay(new Date(now.getTime() + PAID_NOTICE_DAYS * DAY));

/** Comptes qui ont plus de prêts en cours que l'offre gratuite (ils devront payer pour en créer d'autres). */
export async function lendersOverFreeCap() {
  const rows = await prisma.loan.groupBy({ by: ["lenderId"], where: { status: "ACTIVE" }, _count: { _all: true } });
  const over = rows.filter((r) => r._count._all > PLANS.FREE.maxLoans).map((r) => r.lenderId);
  if (!over.length) return [];
  const users = await prisma.user.findMany({ where: { id: { in: over } }, select: { id: true, plan: true, planExpiresAt: true } });
  return users.filter((u) => effectivePlan(u) === "FREE").map((u) => u.id);
}

/**
 * Tâche planifiée (avec les rappels, toutes les heures) :
 *  - passage au payant programmé : annonce par e-mail et dans l'appli à chaque utilisateur (une fois par date) ;
 *  - date atteinte : le mode passe à PAID, et ceux qui dépassent l'offre gratuite sont prévenus dans l'appli.
 */
export async function runSiteMode(now = new Date()) {
  const s = await siteSettings();
  if (s.mode !== "BETA" || !s.paidFrom) return { notices: 0, switched: false };

  if (s.paidFrom <= now) {
    await prisma.siteSetting.update({ where: { id: 1 }, data: { mode: "PAID", paidFrom: null, paidSince: now } });
    for (const id of await lendersOverFreeCap()) {
      await notify(id, "Le site est passé en mode payant",
        `Tes prêts en cours sont conservés et restent modifiables. L'offre gratuite permet ${PLANS.FREE.maxLoans} prêts en cours : pour en créer de nouveaux, clôture des prêts rendus ou choisis une offre.`, "/abonnement");
    }
    return { notices: 0, switched: true };
  }

  const users = await prisma.user.findMany({
    where: { disabled: false, emailVerifiedAt: { not: null }, OR: [{ paidModeNoticeFor: null }, { paidModeNoticeFor: { not: s.paidFrom } }] },
    take: 200,
  });
  const date = fmtDate(s.paidFrom);
  for (const u of users) {
    await sendMail({
      to: u.email,
      kind: "paid_mode_notice",
      subject: `${LEGAL.siteName} passe en mode payant le ${date}`,
      title: `Bonjour ${u.name},`,
      paragraphs: [
        `Merci d'avoir utilisé ${LEGAL.siteName} pendant sa phase de test. À partir du ${date}, le site proposera des offres payantes.`,
        `Rien ne sera supprimé : tous tes prêts et ton historique sont conservés, et tu pourras toujours les consulter, les modifier et les clôturer.`,
        `L'offre gratuite reste disponible, avec ${PLANS.FREE.maxLoans} prêts en cours. Au-delà, il faudra clôturer des prêts rendus ou choisir une offre, à partir de ${(FROM_MONTHLY_CENTS / 100).toLocaleString("fr-FR")} € par mois, pour en créer de nouveaux.`,
        `Tu n'as rien à faire d'ici là. Les conditions qui s'appliqueront sont consultables sur ${appUrl()}/cgu.`,
      ],
      cta: { label: "Voir les offres", url: `${appUrl()}/abonnement` },
    });
    await notify(u.id, `Passage au mode payant le ${date}`, "Tes prêts sont conservés. Au-delà de l'offre gratuite, une offre sera nécessaire pour en créer de nouveaux.", "/abonnement");
    await prisma.user.update({ where: { id: u.id }, data: { paidModeNoticeFor: s.paidFrom } });
  }
  return { notices: users.length, switched: false };
}
