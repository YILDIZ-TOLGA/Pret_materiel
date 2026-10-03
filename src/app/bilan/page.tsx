"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Kpi, TimeChart } from "@/components/Charts";
import { Icon } from "@/components/Icon";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { Avatar, CountUp, EmptyState, PageHeader, SkeletonRows } from "@/components/ui";
import { api, dateFr, dateShort, euros, isMoney, norm } from "@/lib/client";

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
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
const eurosTo = (target: number) => (n: number) => euros(Math.abs(n - target) < 0.5 ? target : Math.round(n / 100) * 100);
const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

function reliability(p: Person) {
  const ratio = p.returned ? p.returnedOnTime / p.returned : 0;
  if (p.overdue > 0) return { text: `${p.overdue} en retard`, tone: "late", ratio };
  if (!p.returned) return { text: "Pas d'historique", tone: "", ratio };
  return { text: `${pct(ratio)} à l'heure`, tone: ratio >= 0.8 ? "" : ratio >= 0.5 ? "soon" : "late", ratio };
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
  const [d, setD] = useState<Data | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api<Data>("/api/dashboard").then(setD).catch(() => {}); }, []);
  const byId = useMemo(() => new Map((d?.loans ?? []).map((l) => [l.id, l])), [d]);

  if (!d) return <BilanSkeleton />;
  const t = d.totals;

  if (t.loans === 0) {
    return (
      <>
        <PageHeader title="Bilan" sub="Ce qui est dehors, ce qu'on te doit, et qui rend à l'heure." />
        <div className="card flush">
          <EmptyState title="Pas encore de bilan" action={<Link href="/prets/nouveau" className="btn primary"><Icon name="plus" size={16} />Noter un prêt</Link>}>
            Le bilan se remplit au fil de tes prêts : objets dehors, sommes dues, ponctualité de chacun.
          </EmptyState>
        </div>
      </>
    );
  }

  const nq = norm(q.trim());
  const people = d.people.filter((p) => !nq || norm(`${p.name} ${p.email}`).includes(nq));
  const hasMoney = t.moneyLentCents > 0;

  return (
    <>
      <PageHeader title="Bilan" sub="Ce qui est dehors, ce qu'on te doit, et qui rend à l'heure."
        actions={<button type="button" className="btn" onClick={() => exportCsv(d.loans)}><Icon name="download" size={15} />Exporter en CSV</button>} />

      <section className="stats rise" style={{ "--i": 0 } as React.CSSProperties} aria-label="Chiffres clés">
        <div className="stat">
          <div className="stat-label"><Icon name="banknote" size={15} />On te doit</div>
          <div className="stat-value"><CountUp value={t.owedCents} format={eurosTo(t.owedCents)} /></div>
          <div className="stat-sub">{t.overdueOwedCents > 0 ? <span className="late-text">dont {euros(t.overdueOwedCents)} en retard</span> : hasMoney ? "Rien en retard" : "Aucun prêt d'argent"}</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Icon name="box" size={15} />Objets dehors</div>
          <div className="stat-value"><CountUp value={t.objectsOut} /></div>
          <div className="stat-sub">{t.overdue > 0 ? <span className="late-text">{plural(t.overdue, "prêt")} en retard</span> : "Aucun retard"}</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Icon name="clock" size={15} />Rendus à l&apos;heure</div>
          <div className="stat-value">{t.onTimeRate == null ? "—" : <CountUp value={Math.round(t.onTimeRate * 100)} format={(n) => `${Math.round(n)} %`} />}</div>
          <div className="stat-sub">{t.returned ? `sur ${plural(t.returned, "prêt")} clôturé${t.returned > 1 ? "s" : ""}` : "Aucun prêt clôturé"}</div>
        </div>
      </section>

      <section className="stats kpis rise" style={{ "--i": 1, marginTop: 14 } as React.CSSProperties}>
        <Kpi label="Prêts au total" value={<CountUp value={t.loans} />} hint={`${t.active} en cours · ${t.returned} clôturé${t.returned > 1 ? "s" : ""}`} />
        <Kpi label="Personnes" value={<CountUp value={t.people} />} hint="dans ton carnet" />
        <Kpi label="Durée moyenne" value={t.avgDays == null ? "—" : `${Math.round(t.avgDays)} j`} hint="avant le retour" />
        {hasMoney && <Kpi label="Argent prêté" value={euros(t.moneyLentCents)} hint={`${euros(t.moneyRepaidCents)} remboursés`} />}
      </section>

      <section className="card flush rise" style={{ "--i": 2, marginTop: 14 } as React.CSSProperties}>
        <div className="card-head"><h2>Prêts par mois</h2><span className="tiny muted mono">12 derniers mois</span></div>
        <div className="card-body">
          <TimeChart data={d.months} x="month" xLabel={monthLabel} height={190}
            series={hasMoney
              ? [{ key: "objects", label: "Objets", color: "var(--series-1)" }, { key: "money", label: "Argent", color: "var(--series-2)" }]
              : [{ key: "objects", label: "Objets", color: "var(--series-1)" }]} />
        </div>
      </section>

      <div className="sec-head">
        <h2>Par emprunteur</h2>
        {d.people.length > 5 && (
          <label className="search ph-search">
            <span className="sr-only">Rechercher une personne</span>
            <Icon name="search" size={15} />
            <input data-page-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une personne…" />
            <kbd>/</kbd>
          </label>
        )}
      </div>
      <div className="people rise" style={{ "--i": 3 } as React.CSSProperties}>
        {people.length === 0
          ? <p className="muted small" style={{ padding: 20, margin: 0 }}>Personne ne correspond à « {q.trim()} ».</p>
          : people.map((p) => (
              <PersonRow key={p.email} p={p} open={open === p.email} onToggle={() => setOpen(open === p.email ? null : p.email)}
                loans={p.loanIds.map((id) => byId.get(id)).filter((l): l is LoanDTO => !!l)} />
            ))}
      </div>
    </>
  );
}

function PersonRow({ p, open, onToggle, loans }: { p: Person; open: boolean; onToggle: () => void; loans: LoanDTO[] }) {
  const [seen, setSeen] = useState(false);
  useEffect(() => { if (open) setSeen(true); }, [open]);
  const rel = reliability(p);
  const meta = [plural(p.total, "prêt"), p.objectsOut > 0 && `${plural(p.objectsOut, "objet")} dehors`, p.owedCents > 0 && `doit ${euros(p.owedCents)}`].filter(Boolean).join(" · ");
  return (
    <div className={`person ${open ? "open" : ""}`}>
      <button type="button" className="person-row" aria-expanded={open} onClick={onToggle}>
        <Avatar name={p.name} />
        <span style={{ minWidth: 0 }}>
          <span className="person-name"><span className="truncate">{p.name}</span>{p.hasAccount && <span className="tag brand">Membre</span>}</span>
          <span className="person-meta" style={{ display: "block" }}>{meta}</span>
        </span>
        <span className={`rel ${rel.tone}`}>
          {p.returned > 0 && <span className="rel-bar"><i style={{ "--ratio": rel.ratio } as React.CSSProperties} /></span>}
          {rel.text}
        </span>
        <Icon name="chevronDown" size={16} className="chev" />
      </button>
      <div className="person-more" inert={!open}>
        <div>
          {(open || seen) && (
            <div className="person-more-in">
              <div className="contact">
                <a href={`mailto:${p.email}`}><Icon name="mail" size={14} />{p.email}</a>
                {p.phone && <a href={`tel:${p.phone}`}><Icon name="phone" size={14} />{p.phone}</a>}
              </div>
              {p.lentCents > 0 && (
                <div className="small muted">Argent : {euros(p.lentCents)} prêtés, {euros(p.repaidCents)} remboursés{p.owedCents > 0 && <> · <span className="late-text">reste {euros(p.owedCents)}</span></>}</div>
              )}
              <div className="lrows">
                {loans.map((l, i) => (
                  <LoanRow key={l.id} loan={l} index={i} href={`/prets/${l.id}`}
                    who={l.status === "RETURNED" && l.returnedAt ? `prêté le ${dateShort(l.lentAt)} · ${isMoney(l) ? "soldé" : "rendu"} le ${dateShort(l.returnedAt)}` : `prêté le ${dateShort(l.lentAt)}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BilanSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="skel" style={{ width: 160, height: 38, marginBottom: 14 }} />
      <div className="skel" style={{ width: 320, height: 12, marginBottom: 36, opacity: .7 }} />
      <div className="stats" style={{ marginBottom: 14 }}>
        {[0, 1, 2].map((i) => <div key={i} className="stat"><div className="skel" style={{ width: 90, height: 10 }} /><div className="skel" style={{ width: 120, height: 40, marginTop: 16 }} /></div>)}
      </div>
      <SkeletonRows n={3} />
    </div>
  );
}
