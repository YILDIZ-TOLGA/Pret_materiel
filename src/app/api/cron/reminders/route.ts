import { runReminders } from "@/lib/loans";
import { runRetention } from "@/lib/retention";
import { error, json } from "@/lib/api";

/** À appeler toutes les heures : `curl -H "Authorization: Bearer $CRON_SECRET" https://ton-site/api/cron/reminders` */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error("Non autorisé", 401);
  return json({ ...(await runReminders()), retention: await runRetention() });
}
