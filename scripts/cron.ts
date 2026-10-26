// Alternative sans HTTP : `npm run cron` (crontab : 0 * * * * cd /app && npm run cron)
import { runReminders } from "../src/lib/loans";
import { prisma } from "../src/lib/db";
import { runRetention } from "../src/lib/retention";
import { runSiteMode } from "../src/lib/sitemode";

import { ensureAppSecret } from "../src/lib/app-secret";

// même clé que le site (liens de désinscription des e-mails), générée et gardée en base si besoin
ensureAppSecret()
  .then(() => runReminders())
  .then((r) => console.log("Rappels envoyés", r))
  .then(() => runRetention())
  .then((r) => console.log("Conservation des données", r))
  .then(() => runSiteMode())
  .then((r) => console.log("Mode du site", r))
  .finally(() => prisma.$disconnect());
