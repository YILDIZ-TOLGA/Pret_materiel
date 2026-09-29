"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { api, euros, loanTitle } from "@/lib/client";

export default function LoansPage() {
  return <AppShell><Loans /></AppShell>;
}

function Loans() {
  const { me } = useMe();
  const [loans, setLoans] = useState<LoanDTO[] | null>(null);
  const [tab, setTab] = useState<"ACTIVE" | "RETURNED">("ACTIVE");
  const [q, setQ] = useState("");

  useEffect(() => { api<{ loans: LoanDTO[] }>("/api/loans").then((r) => setLoans(r.loans)); }, []);
  if (!me) return null;

  const now = Date.now();
  const overdue = (loans ?? []).filter((l) => l.status === "ACTIVE" && new Date(l.dueAt).getTime() < now);
  const shown = (loans ?? []).filter((l) => l.status === tab && (!q || `${l.item} ${l.amountCents ? euros(l.amountCents) : ""} ${l.borrowerName} ${l.borrowerEmail}`.toLowerCase().includes(q.toLowerCase())));
  const max = me.plan.maxLoans;
  const full = me.activeLoans >= max;

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Mes prêts</h1>
        <span className="spacer" />
        {full
          ? <Link href="/abonnement" className="btn primary">⭐ Passer à plus</Link>
          : <Link href="/prets/nouveau" className="btn primary">+ Nouveau prêt</Link>}
      </div>

      {overdue.length > 0 && (
        <div className="alert bad">
          <span>⚠</span>
          <div><strong>{overdue.length} prêt{overdue.length > 1 ? "s" : ""} en retard</strong><br />
            <span className="small">{overdue.map((l) => `${loanTitle(l)} (${l.borrowerName})`).join(", ")}</span></div>
        </div>
      )}

      <div className="card">
        <div className="row small" style={{ marginBottom: 8 }}>
          <span>Offre <strong>{me.plan.name}</strong></span><span className="spacer" />
          <span className="muted">{me.activeLoans} / {max} prêt{max > 1 ? "s" : ""} en cours</span>
        </div>
        <div className={`meter ${full ? "full" : ""}`}><div style={{ width: `${Math.min(100, (me.activeLoans / max) * 100)}%` }} /></div>
        {full && <p className="small muted" style={{ margin: "8px 0 0" }}>Limite atteinte. <Link href="/abonnement">Voir les offres</Link> ou clôture un prêt rendu.</p>}
      </div>

      <div className="tabs">
        <button className={tab === "ACTIVE" ? "active" : ""} onClick={() => setTab("ACTIVE")}>En cours</button>
        <button className={tab === "RETURNED" ? "active" : ""} onClick={() => setTab("RETURNED")}>Rendus</button>
      </div>
      {(loans?.length ?? 0) > 5 && <input placeholder="Rechercher un objet, un montant, une personne…" value={q} onChange={(e) => setQ(e.target.value)} />}

      {loans === null ? <div className="empty">Chargement…</div>
        : shown.length === 0 ? (
          <div className="card empty">
            {tab === "ACTIVE" ? <>Aucun prêt en cours.<br /><Link href="/prets/nouveau">Enregistre ton premier prêt</Link></> : "Aucun prêt rendu pour l'instant."}
          </div>
        ) : (
          <div className="list">{shown.map((l) => <LoanRow key={l.id} loan={l} href={`/prets/${l.id}`} who={l.borrowerName} />)}</div>
        )}
    </div>
  );
}
