// Alternative sans HTTP : `npm run cron` (crontab : 0 * * * * cd /app && npm run cron)
import { runReminders } from "../src/lib/loans";
import { prisma } from "../src/lib/db";
import { runRetention } from "../src/lib/retention";
import { runSiteMode } from "../src/lib/sitemode";
import { runBackup } from "../src/lib/backup";

import { ensureAppSecret } from "../src/lib/app-secret";

async function main() {
  // même clé que le site (liens de désinscription des e-mails), générée et gardée en base si besoin
  await ensureAppSecret();
  let failure: unknown = null;
  try {
    console.log("Rappels envoyés", await runReminders());
    console.log("Conservation des données", await runRetention());
    console.log("Mode du site", await runSiteMode());
  } catch (e) {
    failure = e;
  }
  // une copie de la base par jour vers le stockage de sauvegarde (Railway), même si une tâche a échoué
  console.log("Sauvegarde", await runBackup());
  if (failure) throw failure;
}

main().finally(() => prisma.$disconnect());
