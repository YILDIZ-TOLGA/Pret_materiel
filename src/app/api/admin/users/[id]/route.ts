import { z } from "zod";
import { prisma } from "@/lib/db";
import { error, json, withAdmin, zodError } from "@/lib/api";
import { PAID_PLANS } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  plan: z.enum(["FREE", ...PAID_PLANS]).optional(),
  planExpiresAt: z.coerce.date().nullable().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  disabled: z.boolean().optional(),
});

/** Offrir un abonnement, désactiver un compte, nommer un admin… */
export const PATCH = withAdmin<Ctx>(async (admin, req, { params }) => {
  const id = (await params).id;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);
  if (id === admin.id && (parsed.data.role === "USER" || parsed.data.disabled)) return error("Tu ne peux pas te retirer tes propres droits");
  const user = await prisma.user.update({ where: { id }, data: parsed.data, select: { id: true, plan: true, planExpiresAt: true, role: true, disabled: true } });
  return json({ user });
});

export const DELETE = withAdmin<Ctx>(async (admin, _req, { params }) => {
  const id = (await params).id;
  if (id === admin.id) return error("Tu ne peux pas supprimer ton propre compte ici");
  await prisma.user.delete({ where: { id } });
  return json({ ok: true });
});
