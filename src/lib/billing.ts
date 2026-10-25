import type { Plan, User } from "@prisma/client";
import { LEGAL, TERMS_VERSION } from "./legal";
import { eur, fmtDate } from "./loans";
import { sendMail } from "./mail";
import { PLANS } from "./plans";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const DAY = 86400000;
export const WITHDRAWAL_DAYS = 14;

const parisDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
const fmtDateTime = (d: Date) =>
  d.toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/**
 * Droit de rétractation (art. L221-18 C. conso.) : 14 jours à compter de la conclusion du contrat.
 * Le délai court jusqu'à la fin du 14e jour (heure de Paris).
 */
export const withdrawalDeadline = (startedAt: Date) => new Date(startedAt.getTime() + WITHDRAWAL_DAYS * DAY);

/** Date limite de rétractation si elle est encore possible, sinon null. */
export function openWithdrawal(user: Pick<User, "plan" | "subscriptionStartedAt">, now = new Date()) {
  if (user.plan === "FREE" || !user.subscriptionStartedAt) return null;
  const deadline = withdrawalDeadline(user.subscriptionStartedAt);
  return parisDay(now) <= parisDay(deadline) ? deadline : null;
}

/** Formulaire type de rétractation (annexe de l'art. R221-1 C. conso.), en texte pour les e-mails. */
const withdrawalForm = () => [
  "Formulaire de rétractation (à compléter et renvoyer uniquement si vous souhaitez vous rétracter du contrat) :",
  `À l'attention de ${LEGAL.editor.name}, ${LEGAL.editor.address}, ${LEGAL.editor.email} : je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : abonnement ${LEGAL.siteName}, offre …… Commandé le …… Nom du consommateur …… Adresse e-mail du compte …… Adresse du consommateur …… Signature (uniquement en cas de notification sur papier) …… Date ……`,
];

/**
 * Copie des CGU/CGV en vigueur, jointe à la confirmation de commande (support durable : le client garde
 * le texte exact qu'il a accepté, même si la page change ensuite). Renvoie null si la page est injoignable.
 */
async function termsSnapshot() {
  try {
    const res = await fetch(`${appUrl()}/cgu`, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const html = (await res.text())
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b[^>]*>/gi, "")
      .replace(/<head>/i, `<head><base href="${appUrl()}/"><style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.5;color:#1c1917}table{border-collapse:collapse}td,th{border:1px solid #e7e5e4;padding:4px 8px;text-align:left}nav,header,footer,svg,button{display:none}</style>`);
    return { filename: `conditions-generales-${TERMS_VERSION}.html`, content: html, contentType: "text/html; charset=utf-8" };
  } catch (e) {
    console.error("Copie des CGV pour la confirmation de commande", e);
    return null;
  }
}

/**
 * Confirmation du contrat sur un support durable (art. L221-13 C. conso.) : toutes les informations
 * précontractuelles (art. L221-5), la demande d'exécution immédiate, le délai et le formulaire de
 * rétractation, avec les CGU/CGV en pièce jointe. Envoyée une fois, à la souscription.
 */
export async function sendOrderConfirmation(user: Pick<User, "email" | "name">, plan: Plan, amountCents: number, startedAt: Date) {
  const p = PLANS[plan];
  const { editor, mediator } = LEGAL;
  const deadline = withdrawalDeadline(startedAt);
  const terms = await termsSnapshot();
  return sendMail({
    to: user.email,
    kind: "order_confirmation",
    subject: `Confirmation de ton abonnement ${p.name}`,
    title: `Bonjour ${user.name},`,
    paragraphs: [
      `Nous confirmons ta souscription à l'abonnement ${LEGAL.siteName} ${p.name}, conclue le ${fmtDate(startedAt)}. Montant payé : ${eur(amountCents)} TTC (${p.priceLabel}). ${LEGAL.vatMention}.`,
      `Ce que comprend ton offre : suivi de tes prêts d'objets et d'argent, jusqu'à ${p.maxLoans} prêts en cours, e-mails de confirmation, de rappel et de relance à tes emprunteurs, bilan et export.`,
      p.interval === "month"
        ? "Durée : un mois, renouvelé automatiquement chaque mois, sans engagement. Tu peux résilier à tout moment depuis la page Offre : l'abonnement s'arrête à la fin du mois en cours."
        : "Durée : un an, reconduit tacitement pour un an. Nous te préviendrons par e-mail entre trois mois et un mois avant chaque échéance. Tu peux résilier à tout moment depuis la page Offre : l'abonnement reste actif jusqu'à l'échéance.",
      `Tu as demandé que ton abonnement commence immédiatement. Tu gardes ton droit de rétractation de ${WITHDRAWAL_DAYS} jours, jusqu'au ${fmtDate(deadline)} inclus, sans avoir à te justifier : bouton « Se rétracter du contrat ici » sur la page Offre, ou formulaire ci-dessous par e-mail. Nous te rembourserons alors l'intégralité du montant payé, au plus tard 14 jours après ta demande.`,
      ...withdrawalForm(),
      `Le service est soumis à la garantie légale de conformité des contenus et services numériques (art. L224-25-12 et suivants du Code de la consommation). En cas de litige, après une réclamation écrite à ${editor.email}, tu peux saisir gratuitement le médiateur de la consommation : ${mediator.name} (${mediator.url}).`,
      `Vendeur : ${editor.name}, ${editor.legalForm}, ${editor.address}, SIRET ${editor.siret}, ${editor.rcs}${editor.vatNumber ? `, TVA ${editor.vatNumber}` : ""}. Contact : ${editor.email}, ${editor.phone}.`,
      terms
        ? `Les conditions générales que tu as acceptées (version ${TERMS_VERSION}) sont jointes à cet e-mail. La facture t'est envoyée séparément.`
        : `Les conditions générales que tu as acceptées (version ${TERMS_VERSION}) sont consultables sur ${appUrl()}/cgu. La facture t'est envoyée séparément.`,
    ],
    cta: { label: "Voir mon offre", url: `${appUrl()}/abonnement` },
    attachments: terms ? [terms] : undefined,
  });
}

/** Accusé de réception de la rétractation, sur un support durable, avec la date et l'heure de la demande. */
export async function sendWithdrawalReceipt(user: Pick<User, "email" | "name">, plan: Plan, startedAt: Date, at: Date, refundedCents: number) {
  return sendMail({
    to: user.email,
    kind: "withdrawal_receipt",
    subject: "Accusé de réception de ta rétractation",
    title: `Bonjour ${user.name},`,
    paragraphs: [
      `Nous avons bien reçu ta rétractation du contrat d'abonnement ${LEGAL.siteName} ${PLANS[plan].name}, souscrit le ${fmtDate(startedAt)}. Demande reçue le ${fmtDateTime(at)} (heure de Paris).`,
      "L'abonnement est arrêté immédiatement et ne sera plus jamais prélevé. Ton compte repasse à l'offre gratuite ; tes prêts sont conservés.",
      refundedCents > 0
        ? `Remboursement : ${eur(refundedCents)}, sur le moyen de paiement utilisé lors de l'achat, au plus tard 14 jours après ta demande (en général quelques jours selon ta banque).`
        : `Le remboursement de l'intégralité du montant payé t'est dû : il sera effectué au plus tard 14 jours après ta demande, sur le moyen de paiement utilisé. Si tu ne le vois pas arriver, écris-nous à ${LEGAL.editor.email}.`,
      `Une question ? ${LEGAL.editor.email}`,
    ],
    cta: { label: "Voir mon offre", url: `${appUrl()}/abonnement` },
  });
}
