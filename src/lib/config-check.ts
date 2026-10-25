import bcrypt from "bcryptjs";

/** Site ouvert au public : APP_URL en https (même critère que le cookie « secure » et DEMO_BILLING). */
export const isPublicSite = () => (process.env.APP_URL || "").startsWith("https://");

// Valeurs d'exemple livrées avec le projet (docker-compose.yml, .env.example, code) : jamais en production
const DEFAULT_SECRET = /change-?moi|dev-secret|exemple|example/i;
export const DEFAULT_ADMIN_PASSWORDS = ["admin1234", "change-moi", "changeme", "Admin1234"];

/** Réglages dangereux pour un site public ; renvoie la liste des problèmes (vide = OK). */
export function configProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  const problems: string[] = [];
  const jwt = env.JWT_SECRET || "";
  if (jwt.length < 32 || DEFAULT_SECRET.test(jwt)) {
    problems.push("JWT_SECRET : mets une chaîne aléatoire d'au moins 32 caractères (par exemple : openssl rand -base64 48).");
  }
  const cron = env.CRON_SECRET || "";
  if (cron.length < 24 || DEFAULT_SECRET.test(cron)) {
    problems.push("CRON_SECRET : mets une chaîne aléatoire d'au moins 24 caractères, différente de JWT_SECRET.");
  } else if (cron === jwt) {
    problems.push("CRON_SECRET doit être différent de JWT_SECRET.");
  }
  if (env.ADMIN_PASSWORD && DEFAULT_ADMIN_PASSWORDS.includes(env.ADMIN_PASSWORD)) {
    problems.push("ADMIN_PASSWORD : remplace le mot de passe d'exemple par un mot de passe fort.");
  }
  if (/:\/\/[^:]+:pret@/.test(env.DATABASE_URL || "")) {
    problems.push("DB_PASSWORD : le mot de passe de la base est celui d'exemple (« pret »). À fixer avant le premier lancement : il n'est pris en compte qu'à la création de la base.");
  }
  if (!env.SMTP_HOST || env.SMTP_HOST === "mailpit") {
    problems.push("SMTP_HOST : configure un vrai serveur d'envoi (Brevo, Resend…). Avec Mailpit, aucun e-mail n'arrive à destination.");
  }
  return problems;
}

/** Un compte admin a-t-il encore un mot de passe d'exemple ? */
async function defaultAdminPassword() {
  // import tardif : le seed utilise ce fichier sans ouvrir de connexion à la base
  const { prisma } = await import("./db");
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { email: true, passwordHash: true } });
  for (const a of admins) {
    for (const pw of DEFAULT_ADMIN_PASSWORDS) if (await bcrypt.compare(pw, a.passwordHash)) return a.email;
  }
  return null;
}

/**
 * Appelée au démarrage du serveur (src/instrumentation.ts). Sur un site public, refuse de démarrer
 * tant qu'un secret, un mot de passe ou un réglage d'exemple est encore en place.
 */
export async function checkProductionConfig() {
  if (!isPublicSite()) return;
  const problems = configProblems();
  try {
    const admin = await defaultAdminPassword();
    if (admin) problems.push(`Le compte admin ${admin} a encore un mot de passe d'exemple : mets un ADMIN_PASSWORD fort dans .env et relance (le seed le remplacera au démarrage).`);
  } catch (e) {
    console.error("Vérification des comptes admin impossible (base injoignable ?)", e);
  }
  if (!problems.length) return;
  console.error(`\n✗ Démarrage refusé : le site est public (APP_URL=${process.env.APP_URL}) mais des réglages d'exemple sont encore en place.\n`
    + problems.map((p) => `  - ${p}`).join("\n")
    + "\n\nCorrige le fichier .env puis relance : docker compose up -d\n");
  process.exit(1);
}
