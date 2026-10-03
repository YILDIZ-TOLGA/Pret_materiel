"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LoanForm, toPayload } from "@/components/LoanForm";
import { useMe } from "@/components/Providers";
import { EmptyState, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client";

export default function NewLoanPage() {
  const router = useRouter();
  const { me, refresh } = useMe();
  if (!me) return null;

  if (me.activeLoans >= me.plan.maxLoans) {
    return (
      <>
        <PageHeader title="Nouveau prêt" crumb={{ href: "/prets", label: "Prêts" }} />
        <div className="card flush">
          <EmptyState title={`Limite de ${me.plan.maxLoans} prêt${me.plan.maxLoans > 1 ? "s" : ""} atteinte`}
            action={<Link href="/abonnement" className="btn primary">Voir les offres<Icon name="arrowRight" size={15} /></Link>}>
            Clôture un prêt rendu, ou passe à une offre supérieure à partir de 1 € par mois.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nouveau prêt" crumb={{ href: "/prets", label: "Prêts" }} sub="L'emprunteur reçoit un e-mail de confirmation dès l'enregistrement." />
      <LoanForm submitLabel="Enregistrer le prêt" onCancel={() => router.push("/prets")} onSubmit={async (v) => {
        try {
          const { loan } = await api("/api/loans", { body: toPayload(v) });
          await refresh();
          router.push(`/prets/${loan.id}?created=1`);
        } catch (e) {
          if (e instanceof ApiError && e.code === "LIMIT_REACHED") await refresh();
          throw e;
        }
      }} />
    </>
  );
}
