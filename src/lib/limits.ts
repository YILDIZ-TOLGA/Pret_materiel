/**
 * Garde-fous anti-abus sur les e-mails envoyés aux emprunteurs (tiers), sur 24 h glissantes.
 * Affichés dans les CGU et la politique de confidentialité : après un changement, mettre à jour
 * TERMS_VERSION et LEGAL_UPDATED_AT (src/lib/legal.ts).
 */
export const MAIL_LIMITS = {
  // e-mails reçus par une même adresse, tous prêteurs confondus
  perRecipientPerDay: 5,
  // nouveaux prêts créés par un compte : au moins 5, sinon la limite de son offre (saisie initiale de ses prêts)
  minLoansPerDay: 5,
  // rappels au total pour un même prêt (veille + relances automatiques et manuelles)
  remindersPerLoan: 8,
};
