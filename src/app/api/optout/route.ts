import { prisma } from "@/lib/db";
import { checkOptOutToken } from "@/lib/optout";
import { error, json } from "@/lib/api";

/**
 * Désinscription des e-mails de rappel (droit d'opposition, art. 21 RGPD).
 * Paramètres `e` et `t` en query (désinscription en 1 clic RFC 8058) ou en JSON.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const body = q.get("e") ? null : await req.json().catch(() => null);
  const email = String(q.get("e") ?? body?.e ?? "").trim().toLowerCase();
  const token = String(q.get("t") ?? body?.t ?? "");
  if (!email || !checkOptOutToken(email, token)) return error("Lien de désinscription invalide", 400);
  await prisma.emailOptOut.upsert({ where: { email }, update: {}, create: { email } });
  // Le prêteur n'enverra plus de relance automatique à cette adresse
  await prisma.loan.updateMany({ where: { borrowerEmail: email, status: "ACTIVE" }, data: { autoReminder: false, remindBefore: false } });
  return json({ ok: true });
}
