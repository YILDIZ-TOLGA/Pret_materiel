import { prisma } from "./db";

/**
 * Variables d'hébergeur restées sous forme de référence non résolue (ex. « ${{shared.JWT_SECRET}} »
 * sur Railway quand la variable partagée n'existe pas) : traitées comme absentes, jamais utilisées telles quelles.
 */
export function dropUnresolvedReferences() {
  for (const [k, v] of Object.entries(process.env)) if (v?.startsWith("${{")) delete process.env[k];
}

/**
 * Clé de signature des sessions et des liens de désinscription (JWT_SECRET).
 * En production, si elle n'est pas fournie par l'hébergeur, elle est générée une fois au hasard et
 * gardée en base : le site et la tâche horaire (qui partagent la base) utilisent ainsi la même clé,
 * sans que personne n'ait à la créer ni à la recopier. Une clé fournie dans JWT_SECRET reste prioritaire.
 */
export async function ensureAppSecret() {
  dropUnresolvedReferences();
  if (process.env.JWT_SECRET || process.env.NODE_ENV !== "production") return;
  // Web Crypto plutôt que le module « crypto » de Node : ce fichier est aussi compilé pour l'environnement edge
  const generated = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(48))).toString("base64url");
  await prisma.siteSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  // si deux processus démarrent en même temps, un seul écrit sa clé : les deux relisent la même
  await prisma.siteSetting.updateMany({ where: { id: 1, appSecret: null }, data: { appSecret: generated } });
  const row = await prisma.siteSetting.findUniqueOrThrow({ where: { id: 1 }, select: { appSecret: true } });
  process.env.JWT_SECRET = row.appSecret!;
}
