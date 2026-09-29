"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { api } from "@/lib/client";

export default function BorrowedPage() {
  const [loans, setLoans] = useState<LoanDTO[] | null>(null);
  useEffect(() => { api("/api/borrowed").then((r) => setLoans(r.loans)); }, []);
  const active = loans?.filter((l) => l.status === "ACTIVE") ?? [];
  const done = loans?.filter((l) => l.status === "RETURNED") ?? [];
  return (
    <AppShell>
      <div className="stack">
        <h1 style={{ margin: 0 }}>Ce qu&apos;on m&apos;a prêté</h1>
        <p className="muted small" style={{ margin: 0 }}>Les prêts enregistrés par d&apos;autres membres avec ton adresse e-mail.</p>
        {loans === null ? <div className="empty">Chargement…</div> : loans.length === 0 ? <div className="card empty">Personne ne t&apos;a prêté quelque chose pour l&apos;instant.</div> : <>
          {active.length > 0 && <div className="list">{active.map((l) => <LoanRow key={l.id} loan={l} who={`prêté par ${l.lender?.name}`} />)}</div>}
          {done.length > 0 && <><h3 style={{ marginTop: 8 }}>Déjà rendus</h3><div className="list">{done.map((l) => <LoanRow key={l.id} loan={l} who={`prêté par ${l.lender?.name}`} />)}</div></>}
        </>}
      </div>
    </AppShell>
  );
}
