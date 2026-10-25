import { prisma } from "@/lib/db";
import { checkLegacyOptOutToken, emailFromOptOutToken, maskEmail } from "@/lib/optout";
import { error, json } from "@/lib/api";

/** Adresse désignée par le lien : jeton chiffré `t`, ou ancien format `e` (en clair) + `t` (signature). */
function emailFrom(e: string, t: string) {
  if (!t) return null;
  if (e) return checkLegacyOptOutToken(e, t) ? e.trim().toLowerCase() : null;
  return emailFromOptOutToken(t);
}

/** Adresse concernée, masquée, pour l'afficher sur la page de désinscription. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const email = emailFrom(q.get("e") ?? "", q.get("t") ?? "");
  if (!email) return error("Lien de désinscription invalide", 400);
  return json({ email: maskEmail(email) });
}

/**
 * Désinscription des e-mails de rappel (droit d'opposition, art. 21 RGPD).
 * Paramètres en query (désinscription en 1 clic RFC 8058) ou en JSON.
 */
export async function POST(req: Request) {
  const q = new URL(req.url).searchParams;
  const body = q.get("t") ? null : await req.json().catch(() => null);
  const email = emailFrom(String(q.get("e") ?? body?.e ?? ""), String(q.get("t") ?? body?.t ?? ""));
  if (!email) return error("Lien de désinscription invalide", 400);
  await prisma.emailOptOut.upsert({ where: { email }, update: {}, create: { email } });
  // Le prêteur n'enverra plus de relance automatique à cette adresse
  await prisma.loan.updateMany({ where: { borrowerEmail: email, status: "ACTIVE" }, data: { autoReminder: false, remindBefore: false } });
  return json({ ok: true });
}
