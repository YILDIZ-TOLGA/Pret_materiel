import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { RETENTION } from "./legal";

/**
 * Sauvegarde quotidienne de la base vers un stockage S3 (bucket Railway, région Amsterdam).
 * Remplace le service `backup` de docker-compose.yml, qui n'existe pas sur Railway, et les
 * sauvegardes automatiques de Railway, réservées à l'offre Pro.
 * Appelée par la tâche horaire : elle ne fait rien si la dernière copie a moins de 20 h.
 * Copies gardées RETENTION.backupDays jours (annoncé dans la politique de confidentialité).
 */
const PREFIX = "pret-";
const MIN_INTERVAL_MS = 20 * 3600_000;

function bucketConfig() {
  const e = process.env;
  if (!e.BACKUP_S3_ENDPOINT || !e.BACKUP_S3_BUCKET || !e.BACKUP_S3_ACCESS_KEY_ID || !e.BACKUP_S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: e.BACKUP_S3_BUCKET,
    client: new S3Client({
      endpoint: e.BACKUP_S3_ENDPOINT,
      region: e.BACKUP_S3_REGION || "auto",
      // adresses « path-style » : anciens buckets Railway (voir leur onglet Credentials) et serveurs S3 de test
      forcePathStyle: e.BACKUP_S3_PATH_STYLE === "true",
      credentials: { accessKeyId: e.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: e.BACKUP_S3_SECRET_ACCESS_KEY },
    }),
  };
}

/**
 * Connexion passée à pg_dump par variables d'environnement, jamais en argument : un message
 * d'erreur (journaux, e-mail d'alerte) répéterait la ligne de commande, mot de passe compris.
 * Les paramètres propres à Prisma (?schema=…, ?connection_limit=…) sont ignorés.
 */
function pgEnv(url: string): NodeJS.ProcessEnv {
  const u = new URL(url);
  return {
    PATH: process.env.PATH,
    NODE_ENV: process.env.NODE_ENV,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    ...(u.searchParams.get("sslmode") ? { PGSSLMODE: u.searchParams.get("sslmode")! } : {}),
  };
}

async function listBackups(client: S3Client, bucket: string) {
  const all: { Key: string; LastModified: Date }[] = [];
  let token: string | undefined;
  do {
    const r = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIX, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key && o.LastModified) all.push({ Key: o.Key, LastModified: o.LastModified });
    token = r.NextContinuationToken;
  } while (token);
  return all;
}

/** Prévient l'admin par e-mail, une fois par 24 h au plus (la tâche réessaie chaque heure). */
async function alertAdmin(message: string) {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return;
  const recent = await prisma.emailLog.count({ where: { kind: "BACKUP_FAILED", createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
  if (recent) return;
  await sendMail({
    to, kind: "BACKUP_FAILED", subject: "Échec de la sauvegarde de la base",
    title: "La sauvegarde de la base a échoué",
    paragraphs: [
      "La sauvegarde quotidienne de la base n'a pas pu être faite. La tâche horaire réessaie toutes les heures.",
      `Erreur : ${message.slice(0, 300)}`,
      "Regarde les journaux du service de la tâche horaire sur Railway.",
    ],
  });
}

export async function runBackup(now = new Date()) {
  const cfg = bucketConfig();
  if (!cfg) return { skipped: "stockage de sauvegarde non configuré (BACKUP_S3_*)" };
  const { client, bucket } = cfg;
  try {
    const existing = await listBackups(client, bucket);
    const last = existing.reduce<Date | null>((m, o) => (!m || o.LastModified > m ? o.LastModified : m), null);
    if (last && now.getTime() - last.getTime() < MIN_INTERVAL_MS) return { skipped: `dernière copie du ${last.toISOString()}` };

    // copie au format « custom » de pg_dump : compressée, restaurable avec pg_restore
    const dir = await mkdtemp(join(tmpdir(), "sauvegarde-"));
    const key = `${PREFIX}${now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-")}.dump`;
    const file = join(dir, key);
    let size = 0;
    try {
      await promisify(execFile)("pg_dump", ["-Fc", "--no-owner", "--no-acl", "-f", file], { env: pgEnv(process.env.DATABASE_URL || ""), timeout: 10 * 60_000 })
        .catch((e: { stderr?: string; message: string }) => { throw new Error(`pg_dump : ${(e.stderr || e.message).trim()}`); });
      const body = await readFile(file);
      size = body.length;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/octet-stream" }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    // copies plus vieilles que la durée annoncée : supprimées
    const limit = now.getTime() - RETENTION.backupDays * 24 * 3600_000;
    const old = existing.filter((o) => o.LastModified.getTime() < limit);
    if (old.length) {
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: old.map((o) => ({ Key: o.Key })) } }));
    }
    return { saved: key, sizeKB: Math.round(size / 1024), deleted: old.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("ÉCHEC de la sauvegarde", message);
    await alertAdmin(message).catch(() => {});
    return { error: message };
  }
}
