"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LoanForm, toPayload } from "@/components/LoanForm";
import { useMe } from "@/components/Providers";
import { EmptyState, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { MAIN_PLAN } from "@/lib/plans";

export default function NewLoanPage() {
  const router = useRouter();
  const { me, refresh } = useMe();
  if (!me) return null;

  const blocked = me.plan.maxLoans === 0
    ? { title: "Abonnement nécessaire", text: <>Tes prêts restent consultables et continuent. Pour en enregistrer de nouveaux, choisis l&apos;offre {MAIN_PLAN.name} ({MAIN_PLAN.priceLabel}).</>, href: "/abonnement", cta: "Voir l'offre" }
    : me.activeLoans >= me.plan.maxLoans
      ? { title: `Limite de ${me.plan.maxLoans} prêts en cours atteinte`, text: <>Clôture un prêt rendu pour en enregistrer un nouveau.</>, href: "/prets", cta: "Voir les prêts" }
      : !me.termsUpToDate
        ? { title: "Nouvelles conditions à accepter", text: <>Prêt Matériel est désormais réservé aux professionnels, avec des accusés de réception signés. Accepte les nouvelles conditions (bandeau en haut de la page) pour enregistrer un prêt.</>, href: "/cgu", cta: "Lire les conditions" }
        : !me.user.organization
          ? { title: "Nom de ta structure manquant", text: <>Il figure dans les e-mails et les documents envoyés à tes emprunteurs : indique-le dans Mon compte.</>, href: "/compte", cta: "Mon compte" }
          : null;
  if (blocked) {
    return (
      <>
        <PageHeader title="Nouveau prêt" crumb={{ href: "/prets", label: "Prêts" }} />
        <div className="card flush">
          <EmptyState title={blocked.title} action={<Link href={blocked.href} className="btn primary">{blocked.cta}<Icon name="arrowRight" size={15} /></Link>}>{blocked.text}</EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Nouveau prêt" crumb={{ href: "/prets", label: "Prêts" }} sub="Dès l'enregistrement, l'emprunteur reçoit par e-mail l'accusé de réception à signer." />
      <LoanForm submitLabel="Enregistrer et envoyer pour signature" onCancel={() => router.push("/prets")} onSubmit={async (v) => {
        try {
          const { loan, signRequest } = await api("/api/loans", { body: toPayload(v) });
          await refresh();
          router.push(`/prets/${loan.id}?created=${signRequest === "sent" ? 1 : "nomail"}`);
        } catch (e) {
          if (e instanceof ApiError && ["LIMIT_REACHED", "TERMS_UPDATE_REQUIRED", "ORGANIZATION_REQUIRED"].includes(e.code ?? "")) await refresh();
          throw e;
        }
      }} />
    </>
  );
}
