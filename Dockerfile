# Image Node complète (Debian) : contient déjà OpenSSL, nécessaire à Prisma
FROM node:22-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm
WORKDIR /app
ENV NODE_ENV=production
# le site tourne sous un utilisateur sans droits (pas root)
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
# Au démarrage : crée/met à jour les tables, crée le compte admin, lance le site
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p 3000"]
