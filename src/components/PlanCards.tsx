"use client";
import type { Plan } from "@prisma/client";
import { Icon } from "./Icon";
import { Segmented } from "./ui";
import { euros } from "@/lib/client";
import { commonYearlySaving, PLANS, type Interval } from "@/lib/plans";

/** Bascule mensuel / annuel au-dessus des cartes d'offres. */
export function IntervalToggle({ value, onChange }: { value: Interval; onChange: (v: Interval) => void }) {
  const saving = commonYearlySaving();
  return (
    <Segmented<Interval> value={value} onChange={onChange} label="Période de paiement" options={[
      { value: "month", label: "Mensuel" },
      { value: "year", label: <>Annuel{saving && <span className="seg-count">{saving}</span>}</> },
    ]} />
  );
}

/** Carte d'une offre : prix, ce qui est inclus, et le bouton fourni par la page (lien ou paiement). */
export function PlanCard({ plan, title, audience, pro, tag, featured, current, children }: {
  plan: Plan; title: string; audience: string; pro?: boolean; tag?: string | null; featured?: boolean; current?: boolean; children: React.ReactNode;
}) {
  const p = PLANS[plan];
  return (
    <div className={`plan ${current ? "current" : featured ? "featured" : ""}`}>
      <div className="plan-name">{title}{tag && <span className="tag brand">{tag}</span>}{current && <span className="tag">Actuelle</span>}</div>
      <p className="plan-for">{audience}</p>
      <div className="plan-price">{euros(p.priceCents)}{p.interval && <small>/ {p.interval === "month" ? "mois" : "an"}</small>}</div>
      <div className="plan-eq">{p.interval === "year" ? `soit ${euros(Math.round(p.priceCents / 12))} par mois` : p.interval === "month" ? "sans engagement" : "sans carte bancaire"}</div>
      <ul>
        <li><Icon name="check" size={14} />{p.maxLoans} prêt{p.maxLoans > 1 ? "s" : ""} en cours</li>
        <li><Icon name="check" size={14} />Rappels et relances automatiques</li>
        <li><Icon name="check" size={14} />Bilan et export CSV</li>
        {pro && <li><Icon name="check" size={14} />Facture au nom de ta structure</li>}
        {pro && <li><Icon name="check" size={14} />Contrat de sous-traitance RGPD</li>}
      </ul>
      {children}
    </div>
  );
}
