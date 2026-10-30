import { z } from "zod";
import { prisma } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { json, withUser, zodError } from "@/lib/api";
import { TERMS_VERSION } from "@/lib/legal";
import { NO_LINK, noLink } from "@/lib/validation";

const schema = z.object({
  acceptTerms: z.literal(true, { message: "Tu dois accepter les nouvelles conditions générales et confirmer que le compte est utilisé pour une structure" }),
  organization: z.string().trim().min(1, "Nom de la structure requis").max(120).refine(noLink, NO_LINK).optional(),
});

/**
 * Nouvelles conditions (service réservé aux professionnels, accusés de réception signés) : un compte créé avant
 * les accepte ici, avec le nom de sa structure s'il ne l'a pas encore donné. Date et version sont enregistrées.
 */
export const POST = withUser(async (user, req) => {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  const organization = parsed.data.organization ?? user.organization;
  if (!organization) return json({ error: "Indique le nom de ta structure (entreprise, association…).", code: "ORGANIZATION_REQUIRED" }, 400);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { organization, termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION },
  });
  return json({ user: publicUser(updated) });
});
