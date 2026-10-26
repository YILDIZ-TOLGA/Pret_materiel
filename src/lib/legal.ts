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
  // l'identité complète est obligatoire. Source : annuaire-entreprises.data.gouv.fr (SIREN 492 768 742),
  // relevé le 25 octobre 2026. À revérifier sur l'extrait Kbis (capital, RCS) avant la mise en ligne.
  editor: {
    name: "HERMES FINANCE SOURCING - H.F.S.",
    legalForm: `Société à responsabilité limitée (SARL) au capital de ${TODO} €`, // capital : voir le Kbis ou les statuts
    address: "Immeuble Horizon, Esplanade de France, 3 rue Jacques Constant Milleret, 42000 Saint-Étienne",
    siret: "492 768 742 00024",
    rcs: "RCS Saint-Étienne 492 768 742", // greffe du siège, à confirmer sur le Kbis
    // n° de TVA intracommunautaire : seulement si la société est assujettie à la TVA (calculé depuis le SIREN : FR48492768742)
    vatNumber: "",
    email: TODO, // adresse de contact (support et demandes RGPD)
    phone: TODO, // obligatoire pour un professionnel qui vend en ligne
    publicationDirector: "Suzan Yildiz, gérante", // le représentant légal, sauf désignation d'une autre personne
  },

  // Hébergeur du site (LCEN, art. 6 III) : nom, adresse, téléphone.
  host: {
    name: "Railway Corporation", // hébergement du site et de la base (région EU West, Pays-Bas)
    address: TODO, // adresse postale : voir railway.com/legal/terms ou le DPA (railway.com/legal/dpa)
    phone: TODO, // obligatoire (LCEN) : à demander à Railway si absent de ses documents
  },

  // Sous-traitants (RGPD, art. 28) : à ajuster selon les services réellement utilisés.
  processors: [
    { name: "Railway Corporation (États-Unis)", role: "Hébergement du site et de la base de données", location: "Données hébergées dans l'Union européenne (région EU West, Pays-Bas) ; société américaine : transferts éventuels encadrés par l'accord de traitement des données (DPA) de Railway et les clauses contractuelles types de la Commission européenne" },
    { name: "Stripe Payments Europe Ltd.", role: "Paiement des abonnements", location: "Irlande ; transferts possibles vers les États-Unis encadrés par le Data Privacy Framework et des clauses contractuelles types" },
    { name: "Brevo (Sendinblue SAS, France)", role: "Envoi des e-mails de rappel et de service", location: "Union européenne (à confirmer dans l'accord de traitement des données de Brevo)" },
  ],

  // Médiateur de la consommation (Code de la consommation, art. L612-1) : obligatoire pour vendre
  // à des particuliers. Adhésion à faire auprès d'un médiateur agréé (liste : economie.gouv.fr/mediation-conso).
  mediator: {
    name: TODO,
    url: TODO,
  },

  // Mention de TVA à côté des prix, selon le régime de la société (à demander à son comptable) :
  //  - franchise en base de TVA : « TVA non applicable, art. 293 B du CGI » (et vatNumber vide) ;
  //  - assujettie : « TVA 20 % incluse » (et vatNumber renseigné). Les prix de plans.ts sont des prix TTC.
  vatMention: `${TODO} (régime de TVA)`,

  // Âge minimum pour créer un compte (consentement numérique en France : 15 ans).
  minAge: 15,
};

export const TERMS_VERSION = "2026-10-25";
export const LEGAL_UPDATED_AT = "25 octobre 2026";

/** Durées de conservation (appliquées par la purge automatique, voir src/lib/retention.ts). */
export const RETENTION = {
  inactiveAccountYears: 3, // compte sans activité supprimé (après un e-mail de préavis de 30 jours)
  returnedLoanYears: 5, // prêt clôturé : prescription civile de droit commun (art. 2224 C. civ.)
  pageViewMonths: 25, // statistiques de fréquentation (recommandation CNIL : 25 mois max)
  visitorIdMonths: 13, // identifiant de mesure d'audience (recommandation CNIL : 13 mois max)
  emailLogMonths: 12, // journal technique des e-mails envoyés
  readNotificationMonths: 12, // notifications lues
  sessionDays: 30, // session de connexion sur un appareil
  backupDays: 14, // sauvegardes quotidiennes de la base (BACKUP_DAYS dans docker-compose.yml : garder la même valeur)
  verifyEmailLinkHours: 48, // lien de confirmation d'adresse e-mail
  resetPasswordLinkHours: 1, // lien de réinitialisation du mot de passe
};
