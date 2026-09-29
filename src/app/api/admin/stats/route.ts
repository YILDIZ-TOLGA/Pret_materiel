import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { json, withAdmin } from "@/lib/api";
import { PLANS } from "@/lib/plans";

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0);

export const GET = withAdmin(async (_user, req) => {
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);
  const prevSince = new Date(since.getTime() - days * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const activeSince = new Date(now.getTime() - 30 * 86400000);
  const paidWhere = { plan: { not: "FREE" as const }, OR: [{ planExpiresAt: null }, { planExpiresAt: { gt: now } }] };

  const [
    usersTotal, usersNew, usersNewPrev, usersActive,
    revenueMonth, revenueLastMonth, revenueTotal, revenueRange, revenueRangePrev,
    subsByPlan, loansTotal, loansActive, loansOverdue, loansReturned, loansNew,
    emailsOk, emailsFail, viewsRange, viewsPrev,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: activeSince } } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { createdAt: { gte: lastMonthStart, lt: monthStart } } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, _count: true }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { createdAt: { gte: since } } }),
    prisma.payment.aggregate({ _sum: { amountCents: true }, where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.user.groupBy({ by: ["plan"], _count: true, where: paidWhere }),
    prisma.loan.count(),
    prisma.loan.count({ where: { status: "ACTIVE" } }),
    prisma.loan.count({ where: { status: "ACTIVE", dueAt: { lt: now } } }),
    prisma.loan.count({ where: { status: "RETURNED" } }),
    prisma.loan.count({ where: { createdAt: { gte: since } } }),
    prisma.emailLog.count({ where: { createdAt: { gte: since }, ok: true } }),
    prisma.emailLog.count({ where: { createdAt: { gte: since }, ok: false } }),
    prisma.pageView.count({ where: { createdAt: { gte: since } } }),
    prisma.pageView.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
  ]);

  const [visitorsRow] = await prisma.$queryRaw<Row[]>`SELECT COUNT(DISTINCT "visitorId") AS n FROM "PageView" WHERE "createdAt" >= ${since}`;
  const [visitorsPrevRow] = await prisma.$queryRaw<Row[]>`SELECT COUNT(DISTINCT "visitorId") AS n FROM "PageView" WHERE "createdAt" >= ${prevSince} AND "createdAt" < ${since}`;
  const [avgDurRow] = await prisma.$queryRaw<Row[]>`SELECT AVG(EXTRACT(EPOCH FROM ("returnedAt" - "lentAt")) / 86400) AS d, AVG(CASE WHEN "returnedAt" > "dueAt" THEN 1.0 ELSE 0.0 END) AS late FROM "Loan" WHERE status = 'RETURNED' AND "returnedAt" IS NOT NULL`;

  // Séries journalières sur la période (jours sans données = 0)
  const daily = await prisma.$queryRaw<Row[]>`
    WITH d AS (SELECT generate_series(date_trunc('day', ${since}::timestamp), date_trunc('day', ${now}::timestamp), interval '1 day') AS day)
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
      (SELECT COUNT(*) FROM "PageView" p WHERE date_trunc('day', p."createdAt") = d.day) AS views,
      (SELECT COUNT(DISTINCT p."visitorId") FROM "PageView" p WHERE date_trunc('day', p."createdAt") = d.day) AS visitors,
      (SELECT COUNT(*) FROM "User" u WHERE date_trunc('day', u."createdAt") = d.day) AS signups,
      (SELECT COUNT(*) FROM "Loan" l WHERE date_trunc('day', l."createdAt") = d.day) AS loans,
      (SELECT COALESCE(SUM(pay."amountCents"), 0) FROM "Payment" pay WHERE date_trunc('day', pay."createdAt") = d.day) AS revenue
    FROM d ORDER BY d.day`;

  const monthly = await prisma.$queryRaw<Row[]>`
    WITH m AS (SELECT generate_series(date_trunc('month', ${now}::timestamp) - interval '11 months', date_trunc('month', ${now}::timestamp), interval '1 month') AS month)
    SELECT to_char(m.month, 'YYYY-MM') AS month,
      (SELECT COALESCE(SUM(p."amountCents"), 0) FROM "Payment" p WHERE date_trunc('month', p."createdAt") = m.month) AS revenue,
      (SELECT COUNT(*) FROM "Payment" p WHERE date_trunc('month', p."createdAt") = m.month) AS payments,
      (SELECT COUNT(*) FROM "User" u WHERE date_trunc('month', u."createdAt") = m.month) AS signups
    FROM m ORDER BY m.month`;

  const top = (col: string) => prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT COALESCE(${Prisma.raw(`"${col}"`)}, 'Inconnu') AS label, COUNT(*) AS n, COUNT(DISTINCT "visitorId") AS visitors
    FROM "PageView" WHERE "createdAt" >= ${since} GROUP BY 1 ORDER BY n DESC LIMIT 10`);
  const [pages, referrers, devices, browsers, countries] = await Promise.all([top("path"), top("referrer"), top("device"), top("browser"), top("country")]);

  const [recentPayments, recentUsers, revenueByPlan] = await Promise.all([
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { email: true, name: true } } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, email: true, plan: true, createdAt: true } }),
    prisma.payment.groupBy({ by: ["plan"], _sum: { amountCents: true }, _count: true, where: { createdAt: { gte: since } } }),
  ]);

  const subs = Object.fromEntries(subsByPlan.map((s) => [s.plan, s._count]));
  const paying = subsByPlan.reduce((a, s) => a + s._count, 0);
  // MRR : mensuel au prix plein, annuels ramenés au mois
  const mrrCents = subsByPlan.reduce((a, s) => a + (PLANS[s.plan].interval === "year" ? PLANS[s.plan].priceCents / 12 : PLANS[s.plan].priceCents) * s._count, 0);
  const visitors = num(visitorsRow?.n);

  return json({
    days,
    kpis: {
      revenueMonth: revenueMonth._sum.amountCents ?? 0,
      revenueLastMonth: revenueLastMonth._sum.amountCents ?? 0,
      revenueTotal: revenueTotal._sum.amountCents ?? 0,
      paymentsTotal: revenueTotal._count,
      revenueRange: revenueRange._sum.amountCents ?? 0,
      revenueRangePrev: revenueRangePrev._sum.amountCents ?? 0,
      mrrCents: Math.round(mrrCents),
      arrCents: Math.round(mrrCents * 12),
      paying,
      subs,
      arpuCents: usersTotal ? Math.round((revenueTotal._sum.amountCents ?? 0) / usersTotal) : 0,
      conversion: usersTotal ? paying / usersTotal : 0,
      usersTotal, usersNew, usersNewPrev, usersActive,
      loansTotal, loansActive, loansOverdue, loansReturned, loansNew,
      avgLoanDays: avgDurRow?.d == null ? null : num(avgDurRow.d),
      lateReturnRate: avgDurRow?.late == null ? null : num(avgDurRow.late),
      emailsOk, emailsFail,
      views: viewsRange, viewsPrev,
      visitors, visitorsPrev: num(visitorsPrevRow?.n),
      viewsPerVisitor: visitors ? viewsRange / visitors : 0,
      signupRate: visitors ? usersNew / visitors : 0,
    },
    daily: daily.map((r) => ({ day: r.day, views: num(r.views), visitors: num(r.visitors), signups: num(r.signups), loans: num(r.loans), revenue: num(r.revenue) })),
    monthly: monthly.map((r) => ({ month: r.month, revenue: num(r.revenue), payments: num(r.payments), signups: num(r.signups) })),
    traffic: {
      pages: pages.map((r) => ({ label: r.label, n: num(r.n), visitors: num(r.visitors) })),
      referrers: referrers.map((r) => ({ label: r.label === "Inconnu" ? "Direct" : r.label, n: num(r.n), visitors: num(r.visitors) })),
      devices: devices.map((r) => ({ label: r.label, n: num(r.n), visitors: num(r.visitors) })),
      browsers: browsers.map((r) => ({ label: r.label, n: num(r.n), visitors: num(r.visitors) })),
      countries: countries.map((r) => ({ label: r.label, n: num(r.n), visitors: num(r.visitors) })),
    },
    revenueByPlan: revenueByPlan.map((r) => ({ plan: r.plan, cents: r._sum.amountCents ?? 0, count: r._count })),
    recentPayments,
    recentUsers,
  });
});
