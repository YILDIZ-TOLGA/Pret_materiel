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
  const toSign = loans?.filter((l) => l.status === "ACTIVE" && l.ackStatus === "PENDING") ?? [];
  const active = loans?.filter((l) => l.status === "ACTIVE" && l.ackStatus !== "PENDING") ?? [];
  const done = loans?.filter((l) => l.status === "RETURNED") ?? [];

  const who = (l: LoanDTO) => (
    <>
      <Avatar name={l.lender?.organization ?? l.lender?.name ?? "?"} size="xs" />
      <span className="truncate">prêté par {l.lender?.organization ?? l.lender?.name}</span>
      <span className="sep">·</span>
      <span className="nowrap">{l.status === "RETURNED" && l.returnedAt ? `${isMoney(l) ? "remboursé" : "rendu"} le ${dateShort(l.returnedAt)}` : `le ${dateShort(l.lentAt)}`}</span>
      {!!l.receipts?.length && <><span className="sep m-hide">·</span><span className="nowrap m-hide">{l.receipts.length} document{l.receipts.length > 1 ? "s" : ""} signé{l.receipts.length > 1 ? "s" : ""}</span></>}
    </>
  );
  const rows = (list: LoanDTO[], offset = 0) => (
    <div className="lrows">{list.map((l, i) => <LoanRow key={l.id} loan={l} index={i + offset} href={l.url} who={who(l)} />)}</div>
  );

  return (
    <>
      <PageHeader title="Emprunts" sub="Ce qu'on t'a prêté, enregistré avec ton adresse e-mail : accusés de réception à signer et documents signés." />
      {loans === null ? <SkeletonRows n={3} /> : loans.length === 0 ? (
        <div className="card flush">
          <EmptyState title="Rien d'emprunté">
            Quand une structure te prête quelque chose avec ton adresse {me?.user.email ? <strong>{me.user.email}</strong> : "e-mail"}, la fiche apparaît ici, avec l&apos;accusé de réception à signer.
          </EmptyState>
        </div>
      ) : (
        <>
          {toSign.length > 0 && (
            <section className="lgroup">
              <h2 className="section-label late">Accusés de réception à signer<span className="n">{toSign.length}</span></h2>
              {rows(toSign)}
            </section>
          )}
          {active.length > 0 && (
            <section className="lgroup">
              <h2 className="section-label">À rendre<span className="n">{active.length}</span></h2>
              {rows(active, toSign.length)}
            </section>
          )}
          {done.length > 0 && (
            <section className="lgroup">
              <h2 className="section-label">Déjà rendus<span className="n">{done.length}</span></h2>
              {rows(done, toSign.length + active.length)}
            </section>
          )}
        </>
      )}
    </>
  );
}
