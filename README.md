# Prêt Matériel

Appli de rappel de prêts d'objets **et d'argent** : tu notes à qui tu as prêté quoi, l'appli prévient la personne par e-mail, la relance en cas de retard, et tu clôtures le prêt quand l'objet revient (ou quand tout est remboursé).

- **Stack** : Next.js 15 (site + API REST) · PostgreSQL · Prisma · Stripe · Nodemailer
- **Mobile** : interface mobile-first, installable (PWA), API utilisable telle quelle par une appli iOS / Android

## Fonctionnalités

| | |
|---|---|
| Comptes | Inscription / connexion (e-mail + mot de passe, sessions JWT : cookie sur le web, `Bearer` sur mobile) |
| Prêts d'objets | Objet, détails, emprunteur (nom, e-mail, tél.), date de prêt, date de retour, note perso. Modifier, clôturer, rouvrir, supprimer |
| Prêts d'argent | Montant + motif (resto, billet de train…). Remboursements partiels avec historique, reste dû calculé, clôture automatique quand tout est remboursé. Les e-mails parlent de montants (« les 30 € restants sur 50 € ») |
| Bilan | Tableau de bord de tout ce que tu as prêté : combien on te doit (dont en retard), objets chez les autres, taux de retour à l'heure, durée moyenne, prêts par mois, et **par personne** : ce qu'elle a, ce qu'elle doit, sa fiabilité, son historique. Export CSV (Excel) |
| Options de rappel | Rappel la veille de l'échéance · relance automatique tous les 3 jours en cas de retard · relance manuelle en 1 clic (max 1/h) |
| E-mails | À la création du prêt, la veille, en cas de retard. Tous journalisés (visibles dans l'admin) |
| Entre membres | Si l'e-mail de l'emprunteur a un compte : notifications dans l'appli + onglet « Emprunts ». Un compte créé plus tard récupère automatiquement ses emprunts |
| Alertes | Bandeau « en retard » + notification au prêteur dès qu'une échéance est dépassée |
| Limites | Gratuit : 1 prêt en cours · Mensuel 2 €/mois : 10 · Annuel 12 €/an : 10 · Annuel 24 €/an : 20 (tout se règle dans `src/lib/plans.ts`) |
| Paiement | Stripe Checkout (carte, PayPal, Apple Pay, Google Pay, SEPA…) + portail client pour changer d'offre ou résilier |
| Admin | Encaissé du mois / mois précédent / total, MRR, ARR, abonnés par offre, conversion, revenu moyen par utilisateur, revenus par mois et par jour, derniers paiements · visiteurs uniques, pages vues, pages/visiteur, taux visiteur→inscrit, top pages, sources, appareils, navigateurs, pays · prêts en cours/en retard/rendus, durée moyenne, taux de retour en retard, e-mails envoyés/échoués · gestion des utilisateurs (recherche, offrir un abonnement, désactiver, nommer admin, supprimer). Comparaison avec la période précédente, filtre 7 j / 30 j / 90 j / 12 mois |
| Analytics | Maison, sans service tiers ni cookie publicitaire (table `PageView`) |

## Démarrer en local

```bash
cp .env.example .env              # puis remplis ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up -d db           # PostgreSQL (ou ta propre instance)
npm install
npx prisma migrate deploy         # crée les tables
npm run db:seed                   # crée le compte admin
npm run db:seed -- --demo         # (optionnel) fausses données pour voir le tableau de bord
npm run dev                       # http://localhost:3000
```

Sans clé Stripe, en développement, cliquer sur une offre l'active directement (mode démo) pour tester.
Sans SMTP, les e-mails sont affichés dans la console.

## Mise en production

1. **Base** : n'importe quel PostgreSQL (Neon, Supabase, Scaleway, OVH, Railway…). Mets l'URL dans `DATABASE_URL`.
2. **Hébergement** : `docker compose --profile prod up -d --build` sur un VPS, ou Vercel / Railway / Render (build : `npm run build`, puis `npx prisma migrate deploy`).
3. **E-mails** : un fournisseur SMTP (Brevo, Resend, Mailgun…) → variables `SMTP_*` et `MAIL_FROM`.
4. **Rappels automatiques** : appeler toutes les heures
   `curl -H "Authorization: Bearer $CRON_SECRET" https://ton-site/api/cron/reminders`
   (cron du serveur, Vercel Cron, cron-job.org…) ou `npm run cron`.
5. **Stripe** :
   - crée 3 produits/prix récurrents : 2 €/mois, 12 €/an, 24 €/an → `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY_10`, `STRIPE_PRICE_YEARLY_20` ;
   - active les moyens de paiement voulus dans *Paramètres → Moyens de paiement* (PayPal, Apple Pay, Google Pay…) : ils apparaissent automatiquement, sans toucher au code ;
   - webhook vers `https://ton-site/api/billing/webhook` avec les événements `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` → `STRIPE_WEBHOOK_SECRET` ;
   - active le portail client (*Paramètres → Billing → Customer portal*).

## iPhone / Android

Tout le code métier est dans l'API REST (`/api/*`) ; le front ne fait que des appels `fetch` via `src/lib/client.ts`, qui gère déjà le token `Bearer`. Deux voies :

1. **Le plus simple — PWA** : sur le site, « Ajouter à l'écran d'accueil ». Icône, plein écran, barre d'onglets en bas : ça se comporte comme une appli.
2. **Sur les stores — Capacitor** (config fournie dans `capacitor.config.json`, remplace l'URL par ton domaine) :
   ```bash
   npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   npx cap add ios && npx cap add android
   npx cap open ios        # Xcode   → build App Store
   npx cap open android    # Android Studio → build Play Store
   ```
   Pour une appli 100 % native plus tard (React Native / Expo), l'API est déjà prête : `POST /api/auth/login` renvoie un `token` à envoyer en `Authorization: Bearer`.

⚠️ Apple et Google imposent en général leur propre système de paiement pour un abonnement vendu *dans* l'appli (commission de 15 à 30 %). Solution courante : dans l'appli mobile, ne pas afficher les boutons d'achat et laisser l'abonnement se prendre sur le site.

## Encaisser en euros, recevoir en crypto ?

Oui c'est faisable, mais il ne faut pas coder soi-même un « wrapper » qui reçoit l'argent des clients et le convertit : c'est une activité réglementée (prestataire de services sur crypto-actifs, agrément AMF/MiCA). La bonne façon est de chaîner des services qui ont déjà les agréments :

1. **Stripe encaisse** (carte, PayPal, Apple Pay…) → tes clients ne voient aucune différence.
2. **Conversion automatique** : Stripe propose des versements en stablecoin (USDC) dans certains pays — vérifie si ton compte y a accès (*Paramètres → Versements*). Sinon : versement automatique Stripe vers un compte sur une plateforme agréée (Kraken, Bitstamp, Coinbase…) + achat récurrent automatique + retrait automatique vers ton wallet. Une fois configuré, c'est 100 % automatique.

À savoir : les revenus restent imposables en euros (déclare-les, en micro-entreprise par exemple), et chaque conversion peut avoir des conséquences fiscales. Demande l'avis d'un comptable.

## Structure

```
prisma/schema.prisma        modèle de données (User, Loan, Notification, Payment, PageView, EmailLog)
src/lib/plans.ts            offres et limites
src/lib/loans.ts            e-mails, notifications, tâche de rappels
src/app/api/…               API REST (utilisée par le web et le mobile)
src/app/prets, bilan, emprunts, notifications, abonnement   pages utilisateur
src/app/admin/…             tableau de bord et gestion des utilisateurs
```
