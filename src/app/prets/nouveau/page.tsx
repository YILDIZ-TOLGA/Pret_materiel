"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LoanForm, toPayload } from "@/components/LoanForm";
import { useMe } from "@/components/Providers";
import { api, ApiError } from "@/lib/client";

export default function NewLoanPage() {
  return <AppShell><NewLoan /></AppShell>;
}

function NewLoan() {
  const router = useRouter();
  const { me, refresh } = useMe();
  if (!me) return null;

  if (me.activeLoans >= me.plan.maxLoans) {
    return (
      <div className="stack">
        <h1>Nouveau prêt</h1>
        <div className="card stack center">
          <div style={{ fontSize: 40 }}>⭐</div>
          <strong>Tu as atteint ta limite de {me.plan.maxLoans} prêt{me.plan.maxLoans > 1 ? "s" : ""} en cours.</strong>
          <p className="muted">Clôture un prêt rendu, ou passe à une offre supérieure (dès 1 € / mois).</p>
          <Link href="/abonnement" className="btn primary">Voir les offres</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/prets" className="small">← Mes prêts</Link>
      <h1 style={{ marginTop: 8 }}>Nouveau prêt</h1>
      <LoanForm submitLabel="Enregistrer et prévenir" onSubmit={async (v) => {
        try {
          const { loan } = await api("/api/loans", { body: toPayload(v) });
          await refresh();
          router.push(`/prets/${loan.id}?created=1`);
        } catch (e) {
          if (e instanceof ApiError && e.code === "LIMIT_REACHED") { await refresh(); }
          throw e;
        }
      }} />
    </div>
  );
}
