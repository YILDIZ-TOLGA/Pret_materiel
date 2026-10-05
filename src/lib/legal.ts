/**
 * Informations légales affichées dans les mentions légales, la politique de confidentialité et les CGU/CGV.
 *
 * ⚠️ À REMPLIR AVANT LA MISE EN LIGNE : tant qu'une valeur contient « À COMPLÉTER »,
 * elle s'affiche telle quelle sur le site (c'est voulu : impossible de l'oublier).
 * Après une modification des CGU/CGV, change TERMS_VERSION et LEGAL_UPDATED_AT.
 */
const TODO = "[À COMPLÉTER]";

export const LEGAL = {
  siteName: "Prêt Matériel",
  siteUrl: process.env.APP_URL || "https://pret-materiel.fr",

  // Éditeur du site (LCEN, art. 6 III). Vendre des abonnements = activité professionnelle :
  // l'identité complète est obligatoire, même en micro-entreprise.
  editor: {
    name: TODO, // ex. « Tolga Yildiz, entrepreneur individuel » ou « Prêt Matériel SAS »
    legalForm: TODO, // ex. « Entrepreneur individuel (micro-entreprise) » ou « SAS au capital de 1 000 € »
    address: TODO, // adresse postale complète (domiciliation possible)
    siret: TODO, // SIRET (ou RCS + numéro pour une société)
    vatNumber: "", // n° de TVA intracommunautaire, si assujetti
    email: TODO, // adresse de contact (support et demandes RGPD)
    phone: TODO, // obligatoire pour un professionnel qui vend en ligne
    publicationDirector: TODO, // en général le représentant légal
  },

  // Hébergeur du site (LCEN, art. 6 III) : nom, adresse, téléphone.
  host: {
    name: TODO, // ex. « OVH SAS », « Scaleway SAS », « Vercel Inc. »
    address: TODO,
    phone: TODO,
  },

  // Sous-traitants (RGPD, art. 28) : à ajuster selon les services réellement utilisés.
  processors: [
    { name: "Hébergeur du site et de la base de données", role: "Hébergement", location: "Union européenne (à vérifier selon l'hébergeur choisi)" },
    { name: "Stripe Payments Europe Ltd.", role: "Paiement des abonnements", location: "Irlande ; transferts possibles vers les États-Unis encadrés par le Data Privacy Framework et des clauses contractuelles types" },
    { name: "Prestataire d'envoi d'e-mails (SMTP)", role: "Envoi des e-mails de rappel et de service", location: "À COMPLÉTER (ex. Brevo, France)" },
  ],

  // Médiateur de la consommation (Code de la consommation, art. L612-1) : obligatoire pour vendre
  // à des particuliers. Adhésion à faire auprès d'un médiateur agréé (liste : economie.gouv.fr/mediation-conso).
  mediator: {
    name: TODO,
    url: TODO,
  },

  // Mention de TVA à côté des prix. Micro-entreprise en franchise : « TVA non applicable, art. 293 B du CGI ».
  vatMention: "TVA non applicable, art. 293 B du CGI",

  // Âge minimum pour créer un compte (consentement numérique en France : 15 ans).
  minAge: 15,
};

export const TERMS_VERSION = "2026-10-05";
export const LEGAL_UPDATED_AT = "5 octobre 2026";

/** Durées de conservation (appliquées par la purge automatique, voir src/lib/retention.ts). */
export const RETENTION = {
  inactiveAccountYears: 3, // compte sans activité supprimé (après un e-mail de préavis de 30 jours)
  returnedLoanYears: 5, // prêt clôturé : prescription civile de droit commun (art. 2224 C. civ.)
  pageViewMonths: 25, // statistiques de fréquentation (recommandation CNIL : 25 mois max)
  visitorIdMonths: 13, // identifiant de mesure d'audience (recommandation CNIL : 13 mois max)
  emailLogMonths: 12, // journal technique des e-mails envoyés
  readNotificationMonths: 12, // notifications lues
  sessionDays: 30, // session de connexion sur un appareil
  verifyEmailLinkHours: 48, // lien de confirmation d'adresse e-mail
  resetPasswordLinkHours: 1, // lien de réinitialisation du mot de passe
};
