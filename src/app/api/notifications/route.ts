import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

export const GET = withUser(async (user) => {
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return json({ notifications });
});

/** Marque toutes les notifications (ou { id }) comme lues. */
export const POST = withUser(async (user, req) => {
  const body = await req.json().catch(() => ({}));
  await prisma.notification.updateMany({ where: { userId: user.id, ...(body.id ? { id: String(body.id) } : {}) }, data: { read: true } });
  return json({ ok: true });
});
