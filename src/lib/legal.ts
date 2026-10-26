/**
 * Informations légales affichées dans les mentions légales, la politique de confidentialité et les CGU/CGV.
 *
 * Une valeur vide n'est pas affichée (éditeur non professionnel pendant la phase de test gratuite).
 * Après une modification des CGU/CGV, change TERMS_VERSION et LEGAL_UPDATED_AT.
 */

export const LEGAL = {
  siteName: "Prêt Matériel",
  siteUrl: process.env.APP_URL || "https://pret-materiel.fr",

  // Éditeur du site (LCEN, art. 6 III). Phase de test gratuite : un particulier, éditeur non professionnel,
  // qui peut garder son adresse et son téléphone confidentiels en les communiquant à l'hébergeur (LCEN,
  // art. 6, III, 2). Son nom et un e-mail de contact restent obligatoires (RGPD, art. 13 et 14).
  // Pour VENDRE des abonnements, il faudra une activité déclarée (micro-entreprise ou société) : renseigner
  // alors siret, rcs, adresse, téléphone, TVA et médiateur. Sans siret, le passage au payant est bloqué.
  editor: {
    name: "Tolga Yildiz",
    legalForm: "Particulier, éditeur non professionnel (phase de test gratuite)",
    address: "communiquée à l'hébergeur (article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004)",
    siret: "", // vide = pas d'activité commerciale déclarée : rien ne peut être vendu
    rcs: "",
    vatNumber: "",
    email: "contact@codebtpsecure.cloud", // support, demandes RGPD, signalements
    phone: "", // vide : éditeur non professionnel ; obligatoire dès qu'on vend en ligne
    publicationDirector: "Tolga Yildiz",
  },

  // Hébergeur du site (LCEN, art. 6 III) : nom, adresse, téléphone.
  host: {
    name: "Railway Corporation", // hébergement du site et de la base (région EU West, Pays-Bas)
    address: "548 Market St PMB 68956, San Francisco, CA 94104, États-Unis", // source : railway.com/legal/dpa
    // LCEN : le téléphone de l'hébergeur est demandé ; Railway n'en publie pas, on donne son contact officiel
    phone: "non communiqué par l'hébergeur (contact : privacy@railway.com)",
  },

  // Sous-traitants (RGPD, art. 28) : à ajuster selon les services réellement utilisés.
  processors: [
    { name: "Railway Corporation (États-Unis)", role: "Hébergement du site et de la base de données", location: "Données hébergées dans l'Union européenne (région EU West, Pays-Bas) ; société américaine : transferts éventuels encadrés par l'accord de traitement des données (DPA) de Railway et les clauses contractuelles types de la Commission européenne" },
    { name: "Stripe Payments Europe Ltd.", role: "Paiement des abonnements", location: "Irlande ; transferts possibles vers les États-Unis encadrés par le Data Privacy Framework et des clauses contractuelles types" },
    { name: "Brevo (Sendinblue SAS, France)", role: "Envoi des e-mails de rappel et de service", location: "Union européenne (à confirmer dans l'accord de traitement des données de Brevo)" },
  ],

  // Médiateur de la consommation (Code de la consommation, art. L612-1) : obligatoire pour vendre
  // à des particuliers. Adhésion à faire auprès d'un médiateur agréé (liste : economie.gouv.fr/mediation-conso).
  // Vide tant que rien n'est vendu (phase de test gratuite) : les pages l'indiquent.
  mediator: {
    name: "",
    url: "",
  },

  // Mention de TVA à côté des prix, selon le régime de la société (à demander à son comptable) :
  //  - franchise en base de TVA : « TVA non applicable, art. 293 B du CGI » (et vatNumber vide) ;
  //  - assujettie : « TVA 20 % incluse » (et vatNumber renseigné). Les prix de plans.ts sont des prix TTC.
  vatMention: "Mention de TVA précisée à l'ouverture des offres payantes",

  // Âge minimum pour créer un compte (consentement numérique en France : 15 ans).
  minAge: 15,
};

/**
 * Un professionnel identifié (SIRET) peut vendre : condition pour passer le site en mode payant.
 * En développement (tests, paiement de démo), la condition est levée.
 */
export const sellerReady = () => !!LEGAL.editor.siret || process.env.NODE_ENV !== "production";

export const TERMS_VERSION = "2026-10-26";
export const LEGAL_UPDATED_AT = "26 octobre 2026";

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
