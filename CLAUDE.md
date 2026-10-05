# Prêt Matériel : notes de passation pour Claude Code

Ce fichier donne le contexte du projet à une nouvelle session Claude Code.
Claude Code le lit automatiquement quand il est lancé à la racine du dépôt.

## Le produit

Application web (future app iOS/Android) pour suivre ce qu'on prête : **des objets ou de l'argent**.

- L'utilisateur crée un prêt : objet (ou montant + motif), emprunteur (nom, e-mail, tél.), date de prêt, date de retour, options de rappel.
- L'emprunteur reçoit un **e-mail** à la création, la veille de l'échéance, puis des relances tous les 3 jours en cas de retard.
- Si l'e-mail de l'emprunteur correspond à un compte, il reçoit aussi des **notifications dans l'appli** et voit le prêt dans « Emprunts ».
- Le prêteur est alerté quand une échéance est dépassée. Il clôture le prêt quand l'objet revient.
- Pour l'argent : remboursements partiels, reste dû, clôture automatique une fois soldé.
- Page **Bilan** : ce qu'on lui doit, objets dehors, fiabilité par personne, prêts par mois, export CSV.
- **Offres** (dans `src/lib/plans.ts`) : Gratuit = 3 prêts en cours · Perso 3 €/mois ou 30 €/an = 10 · Pro 50 12 €/mois ou 120 €/an = 50 · Pro 200 24 €/mois ou 240 €/an = 200.
  - Règles de la grille : le prix d'un prêt baisse quand on monte d'offre (pour que cumuler des petits comptes ne soit pas rentable), et l'annuel = 10 mois payés (« 2 mois offerts », calculé, jamais écrit à la main).
  - Les offres Pro visent les entreprises et associations : CGV articles 16 (clients pros) et 17 (accord de sous-traitance RGPD). Perso est réservé à l'usage personnel, un seul compte par personne (CGU article 2).
  - Nouveaux prêts plafonnés par 24 h (`maxNewLoansPerDay`) : 30, 50 en Pro 50, 200 en Pro 200.
- **Admin** (`/admin`) :
  - revenus : mois, MRR, ARR, par offre ;
  - analytics maison : visiteurs, pages, sources, appareils, pays ;
  - stats des prêts ;
  - gestion des utilisateurs : offrir une offre, désactiver, nommer admin, supprimer.

Le propriétaire veut quelque chose de **très simple à utiliser**, **facilement portable sur mobile**, avec **PostgreSQL**.
L'interface et les messages sont **en français et au tutoiement**. Garde ce ton, et écris les commentaires de code en français.

## Stack

- **Next.js 15** (App Router), TypeScript, React 19. Le site et l'API REST sont dans le même projet.
- **PostgreSQL + Prisma 6** (`prisma/schema.prisma`, migrations dans `prisma/migrations/`).
- **Auth maison** : JWT HS256 (`jose`) + `bcryptjs`. Cookie `session` httpOnly sur le web, **ou** en-tête `Authorization: Bearer <token>` pour le mobile. `/api/auth/login` et `/api/auth/register` renvoient `token`.
- **E-mails** : `nodemailer` (SMTP). Chaque envoi est journalisé dans la table `EmailLog`.
- **Paiement** : Stripe Checkout + portail client + webhook. **Jamais testé avec de vraies clés.**
- **UI** : composants maison, un seul `src/app/globals.css` (tokens clair/sombre), graphiques SVG maison (`src/components/Charts.tsx`). Pas de framework CSS.
- **Mobile** : PWA (`public/manifest.webmanifest`, `public/sw.js`) + `capacitor.config.json` (à compléter avec le vrai domaine).

## Lancer le projet

### Avec Docker (méthode du propriétaire, sous Windows)
```
demarrer.bat                 # ou : docker compose up -d --build
arreter.bat                  # ou : docker compose down   (données conservées)
docker compose down -v       # tout effacer, base comprise
docker compose logs -f app   # logs du site
```
- Site : http://localhost:3000 · Mailpit (boîte mail de test) : http://localhost:8025
- Admin par défaut : `admin@pret.local` / `admin1234`
- Services : `db` (postgres:16-alpine, exposé sur 127.0.0.1:5432), `app`, `mailpit` (SMTP sur 587), `cron` (appelle `/api/cron/reminders` toutes les heures).
- Au démarrage, `app` exécute `prisma migrate deploy`, puis `tsx prisma/seed.ts` (crée ou met à jour l'admin, sans risque à relancer), puis `next start`.
- Aucun `.env` n'est obligatoire. Les valeurs par défaut sont dans `docker-compose.yml` et se surchargent avec un `.env` (modèle : `.env.example`).
- Après une modification du code : `docker compose up -d --build` pour reconstruire.

### Sans Docker (développement)
```
cp .env.example .env
docker compose up -d db          # juste PostgreSQL
npm install
npx prisma migrate deploy
npm run db:seed                  # admin
npm run db:seed -- --demo        # + fausses données pour voir le dashboard admin
npm run dev
```
- Vérifier : `npx tsc --noEmit` (script `npm run lint`) et `npm run build`.
- Modifier la base : éditer `prisma/schema.prisma`, puis `npx prisma migrate dev --name <nom>`, puis committer la migration.

## Structure

```
prisma/schema.prisma        User, Loan (kind OBJECT|MONEY), Repayment, Notification, Payment, PageView, EmailLog
prisma/seed.ts              admin (+ --demo : 60 faux utilisateurs, paiements, prêts, 4000 pages vues)
scripts/cron.ts             rappels sans HTTP (npm run cron)

src/lib/
  db.ts                     client Prisma
  auth.ts                   JWT, cookie, getCurrentUser() (cookie ou Bearer)
  api.ts                    json(), error(), withUser(), withAdmin()
  plans.ts                  grille tarifaire, limites, mapping des prix Stripe
  validation.ts             schémas zod (loanSchema, repaySchema, checkLoanKind)
  loans.ts                  e-mails et notifications de prêt, runReminders() (logique des rappels)
  mail.ts                   envoi SMTP + gabarit HTML
  stripe.ts                 client Stripe, demoBilling
  client.ts                 (navigateur) fetch api(), formatage €, dates, libellés

src/app/api/
  auth/{register,login,logout,me}
  loans            GET liste, POST créer (vérifie la limite de l'offre → 402 LIMIT_REACHED)
  loans/[id]       GET, PATCH (modifier | {action:"return"|"reopen"|"repay", amountCents}), DELETE
  loans/[id]/remind  relance manuelle (max 1/h)
  borrowed         ce qu'on m'a prêté (par borrowerId ou e-mail)
  dashboard        données de la page Bilan
  notifications    GET, POST (marquer lu)
  billing/{checkout,portal,webhook}
  track            analytics (une ligne PageView par page vue)
  cron/reminders   protégé par Bearer CRON_SECRET
  admin/stats, admin/users, admin/users/[id]

src/app/  (pages, toutes "use client", elles appellent l'API)
  /  /connexion  /inscription  /prets  /prets/nouveau  /prets/[id]
  /bilan  /emprunts  /notifications  /abonnement  /admin  /admin/utilisateurs
src/components/  AppShell (navigation + protection), Providers (contexte « me »),
  LoanForm, LoanList, Charts, AuthForm, AdminNav, Tracker
```

Choix d'architecture à garder : **toute la logique est dans l'API**, les pages ne font que des `fetch`. C'est ce qui permettra une app mobile (Capacitor ou React Native/Expo) qui réutilise la même API avec le token Bearer.

## Variables d'environnement

Voir `.env.example`. Les principales :
- `DATABASE_URL`
- `JWT_SECRET` (obligatoire en production)
- `APP_URL` (s'il commence par `https://`, le cookie devient `secure`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (compte créé par le seed ; un compte inscrit avec `ADMIN_EMAIL` devient aussi ADMIN)
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, et un prix par offre : `STRIPE_PRICE_PERSO_MONTHLY`, `STRIPE_PRICE_PERSO_YEARLY`, `STRIPE_PRICE_PRO50_MONTHLY`, `STRIPE_PRICE_PRO50_YEARLY`, `STRIPE_PRICE_PRO200_MONTHLY`, `STRIPE_PRICE_PRO200_YEARLY`
- `DEMO_BILLING` : sans Stripe, `true` active les offres sans payer. **Il vaut `true` par défaut dans docker-compose : à passer à `false` avant toute mise en ligne publique.**
- `CRON_SECRET`

## État : ce qui est testé

- Sur un vrai PostgreSQL :
  - limite de prêts ;
  - liaison de l'emprunteur (y compris s'il s'inscrit après le prêt) ;
  - rappels J-1 et retard sans doublon ;
  - remboursements partiels et plafonnés au reste dû ;
  - clôture ;
  - 403 sur l'admin pour un non-admin ;
  - stats admin.
- Stack Docker complète lancée à froid sans `.env` : migrations, admin, connexion, e-mail reçu dans Mailpit, service cron, persistance après redémarrage.
- Pages vérifiées en capture d'écran, mobile (390 px) et desktop.

## Non testé, ou à faire (par priorité)

1. **Sécurité des comptes : fait** (`src/lib/account.ts`, table `Session`, table `AuthToken`).
   - Adresse e-mail confirmée par lien (`emailVerifiedAt`). Sans confirmation : pas de rattachement des emprunts, `/api/borrowed` vide, création de prêt refusée (403 `EMAIL_NOT_VERIFIED`), pas de rôle admin via `ADMIN_EMAIL`.
   - Mot de passe oublié, changement de mot de passe et d'adresse e-mail (page Mon compte), alertes e-mail au titulaire.
   - Sessions en base : le JWT porte `sid`, la déconnexion supprime la session, « Déconnecter les autres appareils ».
   - Limitation de débit sur login, register, mot de passe oublié, renvoi de lien, relance et track. Elle reste en mémoire (remise à zéro au redémarrage, une seule instance) : passer à Redis si plusieurs instances.
   - `DEMO_BILLING` est ignoré dès que `APP_URL` est en `https://`.
2. **Stripe réel** : créer les 6 prix (3 produits × mensuel/annuel) et le webhook (`customer.subscription.created/updated/deleted`, `invoice.paid`), puis tester le parcours complet en mode test.
   - Le code vise l'API Stripe 2025 « basil » : `current_period_end` est lu sur l'item d'abonnement, et le prix d'une facture sur `lines.data[0].pricing.price_details.price`.
   - Le propriétaire n'a pas encore d'entreprise. Il crée une micro-entreprise, en attendant bêta gratuite.
3. **SMTP réel** (Brevo, Resend…) et domaine d'envoi (SPF/DKIM) pour ne pas finir en spam.
4. **Déploiement** : VPS avec la même stack Docker + reverse proxy HTTPS (Caddy), `APP_URL` en https, `JWT_SECRET` fort, mot de passe admin changé.
5. **Aucun test automatisé.** En ajouter sur `src/lib/loans.ts` (runReminders), les routes de prêts et les limites d'offre.
6. **Notifications push** : `public/sw.js` gère déjà `push`, mais il n'y a ni abonnement Web Push ni envoi côté serveur. Aujourd'hui les notifications sont seulement dans l'appli, rafraîchies toutes les 60 s.
7. **Mobile** : Capacitor (`npx cap add ios/android`, remplacer `server.url` dans `capacitor.config.json`). Attention : Apple et Google imposent leur paiement intégré pour vendre un abonnement dans l'app. Plan prévu : l'abonnement se prend sur le site.
8. Petites améliorations possibles :
   - pays des visiteurs connus seulement derrière Cloudflare ou Vercel ;
   - page « Mon compte » (changer nom, e-mail, mot de passe, supprimer son compte, RGPD) ;
   - mentions légales et CGV.

## Question posée par le propriétaire (déjà répondue)

Recevoir les paiements en crypto : ne **pas** coder un « wrapper » maison qui encaisse et convertit, car c'est une activité réglementée (PSAN/MiCA). Passer par Stripe (versements en stablecoin si disponibles dans le pays), ou par un versement automatique vers une plateforme agréée avec achat récurrent. Voir la section dédiée du README.

## Environnement du propriétaire

- Windows, dossier du projet : `C:\Users\y1903\Desktop\pret_materiel_projet`, avec Docker Desktop.
- Dépôt : https://github.com/YILDIZ-TOLGA/Pret_materiel (branche `main`).
- Les `.bat` sont stockés en CRLF (`.gitattributes` : `*.bat -text`), tout le reste en LF.
