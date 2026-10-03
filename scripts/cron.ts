// Alternative sans HTTP : `npm run cron` (crontab : 0 * * * * cd /app && npm run cron)
import { runReminders } from "../src/lib/loans";
import { prisma } from "../src/lib/db";
import { runRetention } from "../src/lib/retention";

runReminders()
  .then((r) => console.log("Rappels envoyés", r))
  .then(() => runRetention())
  .then((r) => console.log("Conservation des données", r))
  .finally(() => prisma.$disconnect());
