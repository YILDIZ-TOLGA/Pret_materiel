# Conformité légale (RGPD, LCEN, Code de la consommation)

Ce document liste ce qui est déjà fait dans le code, et **ce qu'il te reste à faire toi-même** avant d'ouvrir le site au public. Il ne remplace pas l'avis d'un avocat : pour être vraiment tranquille, fais relire les pages légales par un professionnel (souvent quelques centaines d'euros).

## ✅ À faire avant la mise en ligne

1. **Remplir `src/lib/legal.ts`** : identité de l'éditeur (nom, forme juridique, adresse, SIRET, e-mail, téléphone), hébergeur, prestataire e-mail, médiateur. Tant que c'est vide, les pages affichent « [À COMPLÉTER] ».
2. **Avoir un statut** : vendre des abonnements = activité professionnelle. Une micro-entreprise suffit (autoentrepreneur.urssaf.fr). Sans SIRET, tu ne peux pas vendre légalement.
3. **Adhérer à un médiateur de la consommation** (obligatoire pour vendre à des particuliers, ~50 à 150 €/an). Liste : https://www.economie.gouv.fr/mediation-conso — puis renseigner `mediator` dans `legal.ts`.
4. **Vérifier la mention TVA** (`vatMention`) : « TVA non applicable, art. 293 B du CGI » en franchise de TVA ; sinon mettre ton n° de TVA.
5. **Relire l'article L215-1 dans les CGV** (section 14 de `/cgu`) contre le texte officiel sur Légifrance : la loi impose qu'il soit reproduit **intégralement** (art. L215-4). Le texte a été repris de mémoire et peut avoir été modifié depuis.
6. **Signer les contrats de sous-traitance (DPA)** avec l'hébergeur, Stripe et le prestataire SMTP (souvent accepté automatiquement dans leurs conditions : vérifie) ; ajuster la liste `processors` dans `legal.ts`.
7. **Choisir un hébergement dans l'UE** si possible (OVH, Scaleway, Hetzner…), et mettre le site en **HTTPS** (`APP_URL` en `https://`).
8. **Stripe** : renseigner l'URL des CGV et de la politique de confidentialité dans *Paramètres → Informations publiques*, et activer les e-mails de reçu. Mettre `DEMO_BILLING=false`.
9. **Rappels / purge** : le service `cron` (ou l'appel horaire à `/api/cron/reminders`) doit tourner en production : c'est lui qui applique les durées de conservation et envoie les préavis obligatoires.
10. **Tenir à jour le registre des traitements** ci-dessous (obligatoire, à garder en interne, à montrer à la CNIL en cas de contrôle).

## Ce qui est en place dans le code

| Obligation | Où |
|---|---|
| Mentions légales (LCEN art. 6) | `/mentions-legales` |
| Politique de confidentialité (RGPD art. 13 et 14) | `/confidentialite` |
| CGU + CGV, formulaire de rétractation, reproduction L215-1 à L215-3 et L241-3 | `/cgu` |
| Politique cookies + opposition à la mesure d'audience | `/cookies` |
| Liens légaux sur toutes les pages publiques et dans l'appli | `SiteFooter`, page Mon compte |
| Acceptation des CGU à l'inscription, avec date et version enregistrées | `api/auth/register`, champs `termsAcceptedAt` / `termsVersion` |
| Acceptation des CGV + demande d'exécution immédiate avant paiement (L221-25) | page Offre, `api/billing/checkout`, champ `salesTermsAcceptedAt` |
| Mention TTC / TVA à côté des prix | page d'accueil, page Offre, CGV |
| Résiliation en 3 clics + e-mail de confirmation (L215-1-1, décret 2023-417) | bouton « Résilier votre contrat » → « Confirmer la résiliation », `api/billing/cancel` |
| Préavis de reconduction des abonnements annuels (loi Chatel, L215-1) | `src/lib/retention.ts`, e-mail 35 à 75 jours avant l'échéance |
| Droit d'accès / portabilité (art. 15, 20) | Mon compte → « Télécharger mes données » (`api/account/export`) |
| Droit de rectification (art. 16) | Mon compte → prénom, adresse e-mail (confirmée par lien), mot de passe |
| Sécurité (art. 32) : adresse e-mail prouvée | lien de confirmation (`src/lib/account.ts`) ; sans confirmation, pas de rattachement des emprunts, pas d'emprunts visibles, pas de nouveau prêt (donc pas d'e-mail à un tiers) |
| Sécurité (art. 32) : sessions révocables | table `Session` : déconnexion réelle, « Déconnecter les autres appareils », toutes les sessions fermées après réinitialisation du mot de passe |
| Sécurité (art. 32) : mot de passe oublié | lien à usage unique valable 1 h, seule l'empreinte SHA-256 est stockée, réponse identique que le compte existe ou non, alerte e-mail au titulaire |
| Droit à l'effacement (art. 17) | Mon compte → « Supprimer mon compte » (annule aussi l'abonnement Stripe) |
| Information et droit d'opposition des emprunteurs sans compte (art. 14, 21) | pied de chaque e-mail de rappel + lien de désinscription signé + en-tête `List-Unsubscribe` (désinscription 1 clic) |
| Durées de conservation appliquées automatiquement | `src/lib/retention.ts` (comptes inactifs 3 ans avec préavis, prêts clôturés 5 ans, stats 25 mois, journaux 12 mois) |
| Mesure d'audience exemptée de consentement CNIL | plus de lien avec le compte, identifiant renouvelé tous les 13 mois, respect de Do Not Track / GPC, opposition sur `/cookies` |
| Préférence de thème clair/sombre : traceur exempté (personnalisation de l'interface demandée par l'utilisateur) | clé `theme` en stockage local, créée seulement si l'utilisateur change le thème, déclarée sur `/cookies` |
| Polices auto-hébergées : aucune requête vers Google Fonts au chargement des pages | `next/font` dans `src/app/layout.tsx` (fichiers téléchargés à la compilation) |
| Sécurité (art. 32) : mots de passe | bcrypt + règle CNIL (8 caractères, 3 types sur 4) + limitation des tentatives (`src/lib/ratelimit.ts`) |

## Registre des traitements (RGPD art. 30)

Responsable du traitement : *(identité de l'éditeur, voir `legal.ts`)*. Pas de DPO obligatoire (pas de traitement à grande échelle de données sensibles).

| Traitement | Finalité | Base légale | Personnes | Données | Destinataires | Durée | Transfert hors UE |
|---|---|---|---|---|---|---|---|
| Gestion des comptes | Fournir le service | Contrat | Utilisateurs | Prénom, e-mail (et nouvelle adresse en attente), date de confirmation de l'e-mail, mot de passe chiffré, dates de connexion et d'acceptation des CGU | Éditeur, hébergeur | Jusqu'à suppression ; 3 ans d'inactivité | Non (si hébergeur UE) |
| Sécurité des comptes | Sessions, confirmation d'adresse, réinitialisation du mot de passe | Contrat / intérêt légitime (art. 32) | Utilisateurs | Sessions (dates), empreinte des liens envoyés, adresse de destination du lien | Éditeur, hébergeur, prestataire SMTP | Sessions 30 jours ; liens 48 h (confirmation) / 1 h (mot de passe) | Selon prestataire SMTP |
| Suivi des prêts | Fournir le service | Contrat | Utilisateurs | Prêts, montants, dates, notes | Éditeur, hébergeur ; emprunteur (partiel) | Prêt clôturé : 5 ans | Non |
| Rappels aux emprunteurs | Relancer pour la restitution | Intérêt légitime | Emprunteurs (tiers) | Nom, e-mail, téléphone, objet/montant, dates | Éditeur, hébergeur, prestataire SMTP | Durée du prêt (+5 ans après clôture) | Selon prestataire SMTP |
| Liste d'opposition | Respecter les désinscriptions | Obligation légale (art. 21) | Emprunteurs | E-mail | Éditeur, hébergeur | Tant que nécessaire | Non |
| Abonnements et paiements | Facturer | Contrat / obligation légale | Clients | Offre, montants, identifiants Stripe | Éditeur, Stripe | 10 ans (comptabilité) | Oui (Stripe, DPF + CCT) |
| Mesure d'audience | Statistiques de fréquentation | Intérêt légitime (exemption CNIL) | Visiteurs | Page, référent, appareil, navigateur, pays, identifiant aléatoire | Éditeur, hébergeur | 25 mois | Non |
| Journal des e-mails | Preuve d'envoi, support | Intérêt légitime | Utilisateurs, emprunteurs | Destinataire, objet, résultat | Éditeur, hébergeur | 12 mois | Non |
| Sécurité | Bloquer les attaques par force brute et les envois abusifs | Intérêt légitime | Visiteurs | Adresse IP, et adresse e-mail saisie sur « mot de passe oublié » (en mémoire uniquement) | — | Quelques minutes à 1 h | Non |

Mesures de sécurité : HTTPS, mots de passe bcrypt, adresse e-mail confirmée, sessions révocables, cookie HttpOnly, limitation des tentatives, accès admin restreint, base non exposée sur Internet (Docker : port lié à 127.0.0.1).

## En cas de demande ou d'incident

- **Demande RGPD par e-mail** : répondre sous **1 mois**. Suppression des données d'un emprunteur : supprimer les prêts le concernant et ajouter son e-mail à la table `EmailOptOut`.
- **Fuite de données** : notifier la CNIL sous **72 h** (https://notifications.cnil.fr) et documenter l'incident, même s'il n'est pas notifié.
