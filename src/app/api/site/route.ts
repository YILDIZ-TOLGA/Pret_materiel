import { json } from "@/lib/api";
import { BETA_LIMITS, siteState } from "@/lib/sitemode";

/** Mode du site, pour les pages publiques (accueil, inscription) : phase de test gratuite ou offres payantes. */
export async function GET() {
  const { mode, paidFrom } = await siteState();
  return json({ mode, paidFrom, betaLimits: BETA_LIMITS });
}
