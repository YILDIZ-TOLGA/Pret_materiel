import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, withAdmin } from "@/lib/api";

export const GET = withAdmin(async (_u, req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const where: Prisma.UserWhereInput = q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25,
      select: {
        id: true, name: true, email: true, role: true, plan: true, planExpiresAt: true, disabled: true, createdAt: true, lastLoginAt: true,
        _count: { select: { loansGiven: true } },
        payments: { select: { amountCents: true } },
      },
    }),
  ]);
  return json({
    total, page, pages: Math.ceil(total / 25),
    users: users.map(({ payments, ...u }) => ({ ...u, spentCents: payments.reduce((a, p) => a + p.amountCents, 0) })),
  });
});
