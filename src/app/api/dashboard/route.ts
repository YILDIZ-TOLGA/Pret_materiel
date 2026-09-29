import { prisma } from "@/lib/db";
import { json, withUser } from "@/lib/api";

type Person = {
  email: string; name: string; phone: string | null; hasAccount: boolean;
  total: number; active: number; overdue: number; returned: number; returnedOnTime: number;
  objectsOut: number; owedCents: number; lentCents: number; repaidCents: number;
  lastLentAt: string; loanIds: string[];
};

/** Bilan de tout ce que l'utilisateur a prêté : totaux, par personne, par mois. */
export const GET = withUser(async (user) => {
  const loans = await prisma.loan.findMany({ where: { lenderId: user.id }, orderBy: { lentAt: "desc" } });
  const now = Date.now();
  const late = (l: (typeof loans)[number]) => l.status === "ACTIVE" && l.dueAt.getTime() < now;
  const owed = (l: (typeof loans)[number]) => (l.kind === "MONEY" && l.amountCents && l.status === "ACTIVE" ? Math.max(0, l.amountCents - l.repaidCents) : 0);

  const people = new Map<string, Person>();
  for (const l of loans) {
    let p = people.get(l.borrowerEmail);
    if (!p) {
      p = { email: l.borrowerEmail, name: l.borrowerName, phone: l.borrowerPhone, hasAccount: false, total: 0, active: 0, overdue: 0, returned: 0, returnedOnTime: 0, objectsOut: 0, owedCents: 0, lentCents: 0, repaidCents: 0, lastLentAt: l.lentAt.toISOString(), loanIds: [] };
      people.set(l.borrowerEmail, p);
    }
    p.hasAccount ||= !!l.borrowerId;
    p.phone ??= l.borrowerPhone;
    p.total++;
    p.loanIds.push(l.id);
    if (l.status === "ACTIVE") {
      p.active++;
      if (l.kind === "OBJECT") p.objectsOut++;
    } else {
      p.returned++;
      if (l.returnedAt && l.returnedAt <= l.dueAt) p.returnedOnTime++;
    }
    if (late(l)) p.overdue++;
    p.owedCents += owed(l);
    if (l.kind === "MONEY" && l.amountCents) { p.lentCents += l.amountCents; p.repaidCents += l.repaidCents; }
  }

  const returned = loans.filter((l) => l.status === "RETURNED" && l.returnedAt);
  const onTime = returned.filter((l) => l.returnedAt! <= l.dueAt).length;
  const avgDays = returned.length ? returned.reduce((a, l) => a + (l.returnedAt!.getTime() - l.lentAt.getTime()) / 86400000, 0) / returned.length : null;

  // 12 derniers mois : nombre de prêts (objets / argent) et montants prêtés
  const months: { month: string; objects: number; money: number; lentCents: number }[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push({ month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, objects: 0, money: 0, lentCents: 0 });
  }
  for (const l of loans) {
    const key = `${l.lentAt.getFullYear()}-${String(l.lentAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.month === key);
    if (!m) continue;
    if (l.kind === "MONEY") { m.money++; m.lentCents += l.amountCents ?? 0; } else m.objects++;
  }

  const money = loans.filter((l) => l.kind === "MONEY");
  return json({
    totals: {
      loans: loans.length,
      active: loans.filter((l) => l.status === "ACTIVE").length,
      objectsOut: loans.filter((l) => l.status === "ACTIVE" && l.kind === "OBJECT").length,
      overdue: loans.filter(late).length,
      owedCents: loans.reduce((a, l) => a + owed(l), 0),
      overdueOwedCents: loans.filter(late).reduce((a, l) => a + owed(l), 0),
      moneyLentCents: money.reduce((a, l) => a + (l.amountCents ?? 0), 0),
      moneyRepaidCents: money.reduce((a, l) => a + l.repaidCents, 0),
      returned: returned.length,
      onTimeRate: returned.length ? onTime / returned.length : null,
      avgDays,
      people: people.size,
    },
    // en retard d'abord, puis ceux qui doivent le plus
    people: [...people.values()].sort((a, b) => b.overdue - a.overdue || b.owedCents - a.owedCents || b.active - a.active || b.lastLentAt.localeCompare(a.lastLentAt)),
    months,
    loans,
  });
});
