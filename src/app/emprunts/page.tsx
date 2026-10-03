"use client";
import { useEffect, useState } from "react";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { Avatar, EmptyState, PageHeader, SkeletonRows } from "@/components/ui";
import { api, dateShort, isMoney } from "@/lib/client";

export default function BorrowedPage() {
  const { me } = useMe();
  const [loans, setLoans] = useState<LoanDTO[] | null>(null);
  useEffect(() => { api("/api/borrowed").then((r) => setLoans(r.loans)).catch(() => setLoans([])); }, []);
  const active = loans?.filter((l) => l.status === "ACTIVE") ?? [];
  const done = loans?.filter((l) => l.status === "RETURNED") ?? [];

  const who = (l: LoanDTO) => (
    <>
      <Avatar name={l.lender?.name ?? "?"} size="xs" />
      <span className="truncate">prêté par {l.lender?.name}</span>
      <span className="sep">·</span>
      <span className="nowrap">{l.status === "RETURNED" && l.returnedAt ? `${isMoney(l) ? "remboursé" : "rendu"} le ${dateShort(l.returnedAt)}` : `le ${dateShort(l.lentAt)}`}</span>
    </>
  );

  return (
    <>
      <PageHeader title="Emprunts" sub="Ce que d'autres membres t'ont prêté, enregistré avec ton adresse e-mail." />
      {loans === null ? <SkeletonRows n={3} /> : loans.length === 0 ? (
        <div className="card flush">
          <EmptyState title="Rien d'emprunté">
            Quand un membre te prête quelque chose avec ton adresse {me?.user.email ? <strong>{me.user.email}</strong> : "e-mail"}, la fiche apparaît ici avec sa date de retour.
          </EmptyState>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="lgroup">
              <h2 className="section-label">À rendre<span className="n">{active.length}</span></h2>
              <div className="lrows">{active.map((l, i) => <LoanRow key={l.id} loan={l} index={i} who={who(l)} />)}</div>
            </section>
          )}
          {done.length > 0 && (
            <section className="lgroup">
              <h2 className="section-label">Déjà rendus<span className="n">{done.length}</span></h2>
              <div className="lrows">{done.map((l, i) => <LoanRow key={l.id} loan={l} index={i + active.length} who={who(l)} />)}</div>
            </section>
          )}
        </>
      )}
    </>
  );
}
