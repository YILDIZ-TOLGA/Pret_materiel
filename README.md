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
| Offres | Gratuit : 3 prêts en cours · Perso 3 €/mois ou 30 €/an : 10 · Pro 50 12 €/mois ou 120 €/an : 50 · Pro 200 24 €/mois ou 240 €/an : 200. L'annuel coûte 10 mois (2 mois offerts). Nouveaux prêts plafonnés par 24 h (30, 50 en Pro 50, 200 en Pro 200) contre les envois abusifs. Tout se règle dans `src/lib/plans.ts` |
| Paiement | Stripe Checkout (carte, PayPal, Apple Pay, Google Pay, SEPA…) + portail client pour changer d'offre ou résilier |
| Admin | Encaissé du mois / mois précédent / total, MRR, ARR, abonnés par offre, conversion, revenu moyen par utilisateur, revenus par mois et par jour, derniers paiements · visiteurs uniques, pages vues, pages/visiteur, taux visiteur→inscrit, top pages, sources, appareils, navigateurs, pays · prêts en cours/en retard/rendus, durée moyenne, taux de retour en retard, e-mails envoyés/échoués · gestion des utilisateurs (recherche, offrir un abonnement, désactiver, nommer admin, supprimer). Comparaison avec la période précédente, filtre 7 j / 30 j / 90 j / 12 mois |
| Analytics | Maison, sans service tiers ni cookie publicitaire (table `PageView`) |

## Lancer avec Docker (le plus simple, Windows / Mac / Linux)

Tout tourne dans Docker : la base PostgreSQL, le site, une boîte mail de test et les rappels automatiques. Rien d'autre à installer.

1. Installe **Docker Desktop** : https://www.docker.com/products/docker-desktop/ et lance-le.
2. Récupère le projet dans un dossier, par exemple `C:\Users\<toi>\Desktop\pret_materiel_projet` :
   - avec Git : `git clone https://github.com/YILDIZ-TOLGA/Pret_materiel.git C:\Users\<toi>\Desktop\pret_materiel_projet`
   - ou sur GitHub : bouton vert **Code → Download ZIP**, puis décompresse.
3. **Windows** : double-clique sur `demarrer.bat`.
   **Mac / Linux** : `docker compose up -d --build` dans le dossier.

Le premier lancement prend quelques minutes (téléchargement et construction), les suivants quelques secondes.

| | |
|---|---|
| Site | http://localhost:3000 |
| Boîte mail de test (tous les e-mails envoyés par le site) | http://localhost:8025 |
| Compte admin | `admin@pret.local` / `admin1234` |

Le site et Mailpit ne sont accessibles que depuis ta machine (127.0.0.1).

- Arrêter : `arreter.bat` (ou `docker compose down`). Les données sont conservées.
- Tout effacer, base comprise : `docker compose down -v`.
- Changer les réglages (mot de passe admin, vrai SMTP, Stripe…) : copie `.env.example` en `.env`, modifie-le, relance `demarrer.bat`.
- Sans clés Stripe, cliquer sur une offre l'active sans payer (`DEMO_BILLING=true`), pratique pour tester. Mets `DEMO_BILLING=false` avant d'ouvrir le site au public.

## Démarrer en local (sans Docker, pour développer)

```bash
cp .env.example .env              # puis remplis ADMIN_EMAIL / ADMIN_PASSWORD
docker compose up -d db           # juste PostgreSQL (ou ta propre instance)
npm install
npx prisma migrate deploy         # crée les tables
npm run db:seed                   # crée le compte admin
npm run db:seed -- --demo         # (optionnel) fausses données pour voir le tableau de bord
npm run dev                       # http://localhost:3000
```

Sans clé Stripe, en développement, cliquer sur une offre l'active directement (mode démo) pour tester.
Sans SMTP, les e-mails sont affichés dans la console.

## Mise en production

> ⚖️ **Avant d'ouvrir au public** : remplis `src/lib/legal.ts` (identité, hébergeur, médiateur…) et suis la checklist de [docs/CONFORMITE.md](docs/CONFORMITE.md) (RGPD, mentions légales, CGV).

1. **Hébergement sur un VPS (recommandé)** : la même stack Docker, avec Caddy devant pour le HTTPS.
   - Fais pointer ton nom de domaine vers l'IP du serveur, ouvre les ports 80 et 443.
   - Copie `.env.example` en `.env` et remplis la partie « Production » : `DOMAIN`, `APP_URL=https://…`, `JWT_SECRET`, `CRON_SECRET`, `DB_PASSWORD` (avant le tout premier lancement), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_*`.
   - Lance : `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
   - Le site n'est alors joignable que par Caddy (HTTPS + HSTS), Mailpit est désactivé et `DEMO_BILLING` forcé à `false`.
   - **Le site refuse de démarrer** tant qu'un réglage d'exemple reste en place (secrets, mot de passe admin `admin1234`, base `pret`, Mailpit) : la liste s'affiche dans `docker compose logs app`.
   - Autre hébergeur (Vercel, Railway, Render) : build `npm run build`, puis `npx prisma migrate deploy` ; mets le site derrière un proxy qui écrit l'IP du visiteur dans `X-Forwarded-For` (la limitation des tentatives en dépend).
2. **Base** : celle du `docker-compose.yml`, ou n'importe quel PostgreSQL (Neon, Supabase, Scaleway, OVH…) via `DATABASE_URL`. Prévois des sauvegardes.
3. **E-mails** : un fournisseur SMTP (Brevo, Resend, Mailgun…) → variables `SMTP_*` et `MAIL_FROM`.
4. **Rappels automatiques** : déjà inclus avec Docker (service `cron`). Sinon, appeler toutes les heures
   `curl -H "Authorization: Bearer $CRON_SECRET" https://ton-site/api/cron/reminders`
   (cron du serveur, Vercel Cron, cron-job.org…) ou `npm run cron`.
5. **Stripe** :
   - crée 3 produits (Perso, Pro 50, Pro 200), chacun avec un prix mensuel et un prix annuel :
     3 €/mois et 30 €/an → `STRIPE_PRICE_PERSO_MONTHLY`, `STRIPE_PRICE_PERSO_YEARLY` ;
     12 €/mois et 120 €/an → `STRIPE_PRICE_PRO50_MONTHLY`, `STRIPE_PRICE_PRO50_YEARLY` ;
     24 €/mois et 240 €/an → `STRIPE_PRICE_PRO200_MONTHLY`, `STRIPE_PRICE_PRO200_YEARLY` ;
   - active les moyens de paiement voulus dans *Paramètres → Moyens de paiement* (PayPal, Apple Pay, Google Pay…) : ils apparaissent automatiquement, sans toucher au code ;
   - webhook vers `https://ton-site/api/billing/webhook` avec les événements `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET` ;
   - active le portail client (*Paramètres → Billing → Customer portal*) et autorise le changement entre les 6 prix ;
   - pour les offres Pro, la page de paiement demande le nom, l'adresse et le n° de TVA de la structure (facture à son nom) ;
   - la clé API doit pouvoir lire les paiements (*charges*) et créer des remboursements (*refunds*) : la rétractation rembourse automatiquement ;
   - limite chaque client à un seul abonnement (*Paramètres → Billing → Subscriptions*).
6. **Référencement** : `robots.txt`, `sitemap.xml` et l'image d'aperçu des liens sont générés avec `APP_URL`, passé au build Docker : reconstruis l'image (`--build`) après avoir changé de domaine.

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

## Mode du site : testeur ou payant

Dans l'admin, page **Mode du site** :
- **Site testeur** (au départ) : tout est gratuit, jusqu'à 200 prêts en cours par compte, aucune offre n'est vendue. Idéal pour fidéliser les premiers utilisateurs.
- **Passer en site payant** : choisis une date au moins 30 jours plus tard. Tous les utilisateurs sont prévenus par e-mail et dans l'appli ; à la date, les offres s'ouvrent. Rien n'est supprimé : au-delà de l'offre gratuite, il faut une offre (ou clôturer des prêts) pour en créer de nouveaux.
- **Repasser en site testeur** : immédiat. Les abonnements Stripe déjà en cours ne sont pas arrêtés automatiquement.
- Le paiement (Stripe, ou le paiement de démo en local) doit être configuré pour programmer le passage au payant.

## Sauvegardes

Le service `backup` de `docker-compose.yml` enregistre une copie complète de la base chaque jour dans le dossier `sauvegardes/` (nom `pret-AAAAMMJJ-HHMM.dump`, heure UTC) et supprime les copies de plus de 14 jours (`BACKUP_DAYS`). Ce dossier contient des données personnelles : il n'est ni dans Git ni dans l'image Docker.

- Voir les sauvegardes : `docker compose logs backup`, ou le dossier `sauvegardes/`.
- Restaurer une sauvegarde (remplace le contenu de la base) :
  ```bash
  docker compose exec -T db pg_restore --clean --if-exists --no-owner -U pret -d pret < sauvegardes/pret-AAAAMMJJ-HHMM.dump
  ```
- En production, copie aussi ce dossier **hors du serveur** (stockage objet chez un autre prestataire, ou ton ordinateur) : une sauvegarde sur la même machine ne protège pas d'une panne de disque.

## Tests

Contre un serveur de dev qui tourne (`npm run dev`), avec la même base :

```bash
DATABASE_URL=… JWT_SECRET=… TEST_BASE_URL=http://localhost:3000 npm run test:securite
DATABASE_URL=… TEST_BASE_URL=http://localhost:3000 npm run test:anti-abus
DATABASE_URL=… JWT_SECRET=… TEST_BASE_URL=http://localhost:3000 npm run test:prets
DATABASE_URL=… TEST_BASE_URL=http://localhost:3000 npm run test:vente
DATABASE_URL=… TEST_BASE_URL=http://localhost:3000 npm run test:mode-site
```

## Structure

```
prisma/schema.prisma        modèle de données (User, Loan, Notification, Payment, PageView, EmailLog)
src/lib/plans.ts            offres et limites
src/lib/loans.ts            e-mails, notifications, tâche de rappels
src/app/api/…               API REST (utilisée par le web et le mobile)
src/app/prets, bilan, emprunts, notifications, abonnement   pages utilisateur
src/app/admin/…             tableau de bord et gestion des utilisateurs
```
