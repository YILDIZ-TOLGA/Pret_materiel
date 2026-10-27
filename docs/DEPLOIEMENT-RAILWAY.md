# Mettre le site en ligne sur Railway

Railway construit l'image à partir du `Dockerfile` du dépôt et redéploie à chaque push sur `main`. Compte une vingtaine de minutes la première fois.

## 0. Avant de commencer

- **Un compte Railway** (railway.com), connecté à ton compte GitHub. Un service web qui tourne en permanence demande une offre payante : vérifie les tarifs sur railway.com/pricing.
- **Un service d'envoi d'e-mails** (Brevo, Resend, Mailgun…) avec ses identifiants SMTP. **Obligatoire** : sans vrai SMTP, le site refuse de démarrer en HTTPS (les e-mails de confirmation et les rappels sont le cœur du produit).
- **Aucun secret à inventer** : sans `JWT_SECRET`, le site génère sa clé au premier démarrage et la garde en base (`src/lib/app-secret.ts`). `CRON_SECRET` est inutile sur Railway (la tâche horaire n'appelle pas le site par HTTP). Le seul secret à saisir est la clé SMTP de Brevo (`SMTP_PASS`).
- **Le compte admin** : pas besoin d'`ADMIN_PASSWORD`. Mets ton adresse dans `ADMIN_EMAIL`, puis inscris-toi sur le site avec cette adresse : en confirmant l'adresse, le compte devient admin.
- **Les mentions légales** : tant que `src/lib/legal.ts` contient « [À COMPLÉTER] » (e-mail, téléphone, capital, TVA, adresse de l'hébergeur, médiateur), ces trous s'affichent sur le site. Remplis-les avant de partager l'adresse publiquement.

## 1. Créer le projet

1. Railway → **New Project** → **Deploy from GitHub repo** → `YILDIZ-TOLGA/Pret_materiel`.
2. Dans le service créé (le site) → **Settings** :
   - **Region** : **EU West (Amsterdam)**. Les données des utilisateurs et des emprunteurs doivent rester dans l'Union européenne (RGPD).
   - **Branch** : `main`.
   - **Healthcheck Path** : `/api/site`.
3. **New** → **Database** → **PostgreSQL**, dans la même région (EU West).

## 2. Variables du site

Service du site → **Variables** → **Raw Editor**, colle et complète :

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_URL=https://<l'adresse de l'étape 3>
JWT_SECRET=<premier secret>
CRON_SECRET=<second secret>
ADMIN_EMAIL=<ton adresse>
ADMIN_PASSWORD=<mot de passe fort : 8 caractères min., 3 types parmi minuscules, majuscules, chiffres, symboles>
SMTP_HOST=<ex. smtp-relay.brevo.com>
SMTP_PORT=587
SMTP_USER=<identifiant SMTP>
SMTP_PASS=<mot de passe SMTP>
MAIL_FROM=Prêt Matériel <no-reply@ton-domaine.fr>
DEMO_BILLING=false
```

Les clés Stripe (`STRIPE_*`) ne sont pas nécessaires tant que le site est en **site testeur** (tout gratuit) : elles le deviendront avant de passer en site payant.

### E-mails : API Brevo obligatoire sur Railway

Railway bloque le SMTP sortant sur les offres Free, Trial et Hobby (le site affiche alors « Échec envoi mail Connection timeout »). Utilise l'API web de Brevo : Brevo → **SMTP et API → Clés API → Générer une nouvelle clé API**, puis ajoute `BREVO_API_KEY` dans les variables partagées. `MAIL_FROM` doit utiliser un domaine authentifié dans ce compte Brevo.

## 3. Adresse publique

1. Service du site → **Settings** → **Networking** → **Generate Domain** (ou **Custom Domain** pour ton propre nom de domaine). Port : `3000`.
2. Recopie l'adresse obtenue (`https://….up.railway.app` ou ton domaine) dans `APP_URL`, puis **Redeploy** : l'adresse est figée dans les pages au moment de la construction (sitemap, aperçus de lien, mentions légales).

Au démarrage, le site crée les tables, puis le compte admin, puis il démarre. **S'il refuse de démarrer**, ouvre **Deployments → View logs** : la liste des réglages à corriger s'y affiche (« Démarrage refusé… »).

## 4. Tâche horaire (rappels, purge, mode du site)

Sans elle, aucun rappel ne part. **New** → **GitHub Repo** → le même dépôt, puis dans ce nouveau service :

- **Settings → Region** : EU West.
- **Settings → Custom Start Command** : `npx tsx scripts/cron.ts`
- **Settings → Cron Schedule** : `0 * * * *` (toutes les heures).
- **Variables** : les mêmes que le site (le plus simple : mets-les en **Shared Variables** du projet et relie-les aux deux services). `JWT_SECRET` doit être identique : il chiffre les liens de désinscription.

Ce service démarre, envoie les rappels, applique les durées de conservation et le mode du site, puis s'arrête jusqu'à l'heure suivante.

## 5. Sauvegardes

Le service `backup` de `docker-compose.yml` n'existe pas sur Railway. Active les **sauvegardes** de la base PostgreSQL dans Railway (onglet **Backups** du service Postgres), et garde une copie hors de Railway de temps en temps :

```bash
pg_dump -Fc "<DATABASE_URL publique de Railway>" -f pret-AAAAMMJJ.dump
```

## 6. Vérifier

1. Ouvre l'adresse du site : la page d'accueil annonce la **phase de test**.
2. Connecte-toi avec `ADMIN_EMAIL` / `ADMIN_PASSWORD` → **Administration → Mode du site** : « Site testeur ».
3. Crée un compte avec une autre adresse : l'e-mail de confirmation doit arriver (sinon, revois les variables `SMTP_*` et le domaine d'envoi : SPF, DKIM).
4. Service cron → **Deployments** : une exécution par heure, avec « Rappels envoyés ».

## 7. Obligations légales liées à Railway

- Railway est une **société américaine** : c'est un sous-traitant au sens du RGPD. Accepte son accord de traitement des données (DPA) : railway.com/legal/dpa, et garde-en une copie.
- Complète l'adresse et le téléphone de l'hébergeur dans `src/lib/legal.ts` (obligatoires dans les mentions légales) à partir des documents légaux de Railway.
- Fais de même pour le prestataire d'e-mails (`LEGAL.processors` dans `src/lib/legal.ts`) et son DPA.

## Mises à jour

Chaque push sur `main` reconstruit et redéploie le site. Les migrations de base s'appliquent au démarrage.
