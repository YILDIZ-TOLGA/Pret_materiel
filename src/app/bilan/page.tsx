"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Kpi, TimeChart } from "@/components/Charts";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { api, dateFr, euros } from "@/lib/client";

type Person = {
  email: string; name: string; phone: string | null; hasAccount: boolean;
  total: number; active: number; overdue: number; returned: number; returnedOnTime: number;
  objectsOut: number; owedCents: number; lentCents: number; repaidCents: number; lastLentAt: string; loanIds: string[];
};
type Data = {
  totals: {
    loans: number; active: number; objectsOut: number; overdue: number; owedCents: number; overdueOwedCents: number;
    moneyLentCents: number; moneyRepaidCents: number; returned: number; onTimeRate: number | null; avgDays: number | null; people: number;
  };
  people: Person[];
  months: { month: string; objects: number; money: number; lentCents: number }[];
  loans: LoanDTO[];
};

const pct = (v: number) => `${Math.round(v * 100)} %`;
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short" });

function reliability(p: Person) {
  if (p.overdue > 0) return { text: `${p.overdue} en retard`, tone: "bad" };
  if (!p.returned) return { text: "Nouveau", tone: "" };
  const r = p.returnedOnTime / p.returned;
  if (r >= 0.8) return { text: `Fiable · ${pct(r)} à l'heure`, tone: "good" };
  if (r >= 0.5) return { text: `${pct(r)} à l'heure`, tone: "warn" };
  return { text: `Souvent en retard · ${pct(r)}`, tone: "bad" };
}

function exportCsv(loans: LoanDTO[]) {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["Type", "Objet / motif", "Montant (€)", "Remboursé (€)", "Emprunteur", "E-mail", "Prêté le", "À rendre le", "Statut", "Rendu le"];
  const rows = loans.map((l) => [
    l.kind === "MONEY" ? "Argent" : "Objet", l.item, l.amountCents ? (l.amountCents / 100).toFixed(2) : "", l.kind === "MONEY" ? (l.repaidCents / 100).toFixed(2) : "",
    l.borrowerName, l.borrowerEmail, dateFr(l.lentAt), dateFr(l.dueAt), l.status === "ACTIVE" ? "En cours" : "Rendu", l.returnedAt ? dateFr(l.returnedAt) : "",
  ]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map(cell).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `mes-prets-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function DashboardPage() {
  return <AppShell><Dashboard /></AppShell>;
}

function Dashboard() {
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<Data>("/api/dashboard").then(setD); }, []);

  const byId = useMemo(() => new Map((d?.loans ?? []).map((l) => [l.id, l])), [d]);
  if (!d) return <div className="empty">Chargement…</div>;
  const t = d.totals;

  if (t.loans === 0) {
    return (
      <div className="stack">
        <h1 style={{ margin: 0 }}>Bilan</h1>
        <div className="card empty">Tu n&apos;as encore rien prêté.<br /><Link href="/prets/nouveau">Enregistre ton premier prêt</Link></div>
      </div>
    );
  }

  const people = d.people.filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase()));
  const hasMoney = t.moneyLentCents > 0;

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Bilan</h1>
        <span className="spacer" />
        <button className="btn small" onClick={() => exportCsv(d.loans)}>⬇ Exporter (CSV)</button>
      </div>

      <div className="card">
        <div className="grid grid-2" style={{ gap: 16 }}>
          <div>
            <div className="kpi-label">On te doit</div>
            <div className="hero">{euros(t.owedCents)}</div>
            <div className="small muted">{t.overdueOwedCents > 0 ? <span style={{ color: "var(--bad)" }}>dont {euros(t.overdueOwedCents)} en retard</span> : hasMoney ? "rien en retard 👌" : "aucun prêt d'argent"}</div>
          </div>
          <div>
            <div className="kpi-label">Objets chez les autres</div>
            <div className="hero">{t.objectsOut}</div>
            <div className="small muted">{t.overdue > 0 ? <span style={{ color: "var(--bad)" }}>{t.overdue} prêt{t.overdue > 1 ? "s" : ""} en retard</span> : "aucun retard 👌"}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-kpi">
        <Kpi label="Prêts au total" value={String(t.loans)} hint={`${t.active} en cours · ${t.returned} rendus`} />
        <Kpi label="Personnes" value={String(t.people)} />
        <Kpi label="Rendus à l'heure" value={t.onTimeRate == null ? "—" : pct(t.onTimeRate)} />
        <Kpi label="Durée moyenne" value={t.avgDays == null ? "—" : `${Math.round(t.avgDays)} j`} />
        {hasMoney && <Kpi label="Argent prêté au total" value={euros(t.moneyLentCents)} hint={`${euros(t.moneyRepaidCents)} remboursés`} />}
      </div>

      <div className="card">
        <h2>Prêts par mois</h2>
        <TimeChart data={d.months} x="month" xLabel={monthLabel} height={180}
          series={hasMoney
            ? [{ key: "objects", label: "Objets", color: "var(--series-1)" }, { key: "money", label: "Argent", color: "var(--series-2)" }]
            : [{ key: "objects", label: "Objets", color: "var(--series-1)" }]} />
      </div>

      <h2 style={{ margin: "8px 0 0" }}>Par personne</h2>
      {d.people.length > 5 && <input placeholder="Rechercher une personne…" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="list">
        {people.map((p) => {
          const rel = reliability(p);
          const isOpen = open === p.email;
          const loans = p.loanIds.map((id) => byId.get(id)!).filter(Boolean);
          return (
            <div key={p.email}>
              <button className="person" onClick={() => setOpen(isOpen ? null : p.email)} aria-expanded={isOpen}>
                <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                <span className="loan-main" style={{ textAlign: "left" }}>
                  <span className="loan-title" style={{ display: "block" }}>{p.name} {p.hasAccount && <span className="badge accent">membre</span>}</span>
                  <span className="muted small">
                    {p.total} prêt{p.total > 1 ? "s" : ""}
                    {p.objectsOut > 0 && ` · ${p.objectsOut} objet${p.objectsOut > 1 ? "s" : ""} chez lui/elle`}
                    {p.owedCents > 0 && ` · doit ${euros(p.owedCents)}`}
                  </span>
                </span>
                <span className={`badge ${rel.tone}`}>{rel.text}</span>
              </button>
              {isOpen && (
                <div className="stack" style={{ marginTop: 12, gap: 8 }}>
                  <div className="row small">
                    <a href={`mailto:${p.email}`}>✉ {p.email}</a>
                    {p.phone && <a href={`tel:${p.phone}`}>📞 {p.phone}</a>}
                  </div>
                  {p.lentCents > 0 && <div className="small muted">Argent : {euros(p.lentCents)} prêtés, {euros(p.repaidCents)} remboursés</div>}
                  <div className="list">{loans.map((l) => <LoanRow key={l.id} loan={l} href={`/prets/${l.id}`} who={dateFr(l.lentAt)} />)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
