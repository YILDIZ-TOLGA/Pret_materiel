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
COPY --from=build /app ./
EXPOSE 3000
# Au démarrage : crée/met à jour les tables, crée le compte admin, lance le site
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p 3000"]
