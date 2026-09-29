// Alternative sans HTTP : `npm run cron` (crontab : 0 * * * * cd /app && npm run cron)
import { runReminders } from "../src/lib/loans";
import { prisma } from "../src/lib/db";

runReminders()
  .then((r) => console.log("Rappels envoyés", r))
  .finally(() => prisma.$disconnect());
