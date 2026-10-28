# Image Node complète (Debian) : contient déjà OpenSSL, nécessaire à Prisma
FROM node:22-bookworm AS build
WORKDIR /app
# Adresse publique du site, figée au build dans les pages statiques (mentions légales, sitemap, aperçus de lien)
ARG APP_URL=http://localhost:3000
ENV APP_URL=$APP_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm
# pg_dump pour la sauvegarde quotidienne (src/lib/backup.ts) : version 18, celle de la base Railway
# (un pg_dump plus récent que le serveur fonctionne, l'inverse non)
RUN install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
# le site tourne sous un utilisateur sans droits (pas root)
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Au démarrage : crée/met à jour les tables, crée le compte admin, lance le site.
# PORT : fourni par l'hébergeur (Railway, Render…), 3000 sinon (Docker Compose).
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT:-3000}"]
