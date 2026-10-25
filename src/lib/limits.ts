/**
 * Garde-fous anti-abus sur les e-mails envoyés aux emprunteurs (tiers), sur 24 h glissantes.
 * Le nombre de nouveaux prêts par jour dépend de l'offre : maxNewLoansPerDay dans src/lib/plans.ts.
 * Affichés dans les CGU et la politique de confidentialité : après un changement, mettre à jour
 * TERMS_VERSION et LEGAL_UPDATED_AT (src/lib/legal.ts).
 */
/** Phase de test (site testeur) : tout est gratuit avec ces limites. Voir src/lib/sitemode.ts. */
export const BETA_LIMITS = { maxLoans: 200, maxNewLoansPerDay: 50 };
/** Préavis minimum avant le passage au mode payant (CGU art. 10). */
export const PAID_NOTICE_DAYS = 30;

export const MAIL_LIMITS = {
  // e-mails reçus par une même adresse, tous prêteurs confondus
  perRecipientPerDay: 5,
  // rappels au total pour un même prêt (veille + relances automatiques et manuelles)
  remindersPerLoan: 8,
};
