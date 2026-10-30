"use client";
import type { Plan } from "@prisma/client";
import { Icon } from "./Icon";
import { euros } from "@/lib/client";
import { PLANS } from "@/lib/plans";

/** Carte de l'offre : prix hors taxes, ce qui est inclus, et le bouton fourni par la page (lien ou paiement). */
export function PlanCard({ plan, current, featured, children }: { plan: Plan; current?: boolean; featured?: boolean; children: React.ReactNode }) {
  const p = PLANS[plan];
  return (
    <div className={`plan ${current ? "current" : featured ? "featured" : ""}`}>
      <div className="plan-name">Offre {p.name}{current && <span className="tag">Actuelle</span>}</div>
      <p className="plan-for">Entreprises, associations, collectivités</p>
      <div className="plan-price">{euros(p.priceCents)}<small>HT / an</small></div>
      <div className="plan-eq">soit {euros(Math.round(p.priceCents / 12))} HT par mois, facture au nom de ta structure</div>
      <ul>
        <li><Icon name="check" size={14} />{p.maxLoans.toLocaleString("fr-FR")} prêts en cours, {p.maxNewLoansPerDay} nouveaux par jour</li>
        <li><Icon name="check" size={14} />Accusé de réception signé en ligne par l&apos;emprunteur</li>
        <li><Icon name="check" size={14} />Reçus de remboursement et attestations de retour signés, en PDF</li>
        <li><Icon name="check" size={14} />Rappels et relances automatiques par e-mail</li>
        <li><Icon name="check" size={14} />Bilan par personne et export CSV</li>
        <li><Icon name="check" size={14} />Contrat de sous-traitance RGPD inclus</li>
      </ul>
      {children}
    </div>
  );
}
