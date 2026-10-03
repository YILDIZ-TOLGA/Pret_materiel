"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { Meter, PageHeader, Spinner } from "@/components/ui";
import { api, dateFr, euros } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import { PAID_PLANS, PLANS } from "@/lib/plans";

export default function BillingPage() {
  return <Suspense><Billing /></Suspense>;
}

function Billing() {
  const { me, refresh } = useMe();
  const sp = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [accept, setAccept] = useState(false);
  const [cancelStep, setCancelStep] = useState(false);
  const [canceled, setCanceled] = useState(false);
  useEffect(() => { if (sp.get("success")) refresh(); }, [sp, refresh]);
  if (!me) return null;

  async function go(path: string, body: object, key: string) {
    setBusy(key); setErr("");
    try { const { url } = await api(path, { body }); location.href = url; }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  }

  async function cancel() {
    setBusy("cancel"); setErr("");
    try { await api("/api/billing/cancel", { method: "POST" }); await refresh(); setCancelStep(false); setCanceled(true); }
    catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  function choose(id: string) {
    if (!accept) { setErr("Coche la case d'acceptation des conditions générales de vente pour continuer."); return; }
    go("/api/billing/checkout", { plan: id, acceptSalesTerms: true }, id);
  }

  const current = me.plan.id;
  const renewal = me.user.planExpiresAt && current !== "FREE" ? dateFr(me.user.planExpiresAt) : null;
  const max = me.plan.maxLoans;
  return (
    <>
      <PageHeader title="Offre" sub="Mensuel sans engagement, résiliable à tout moment." />
      <div className="stack">
        {sp.get("success") && <div className="banner ok"><Icon name="check" size={16} />Paiement confirmé. Ton abonnement est actif.</div>}
        {sp.get("canceled") && <div className="banner soon"><Icon name="info" size={16} />Paiement annulé. Aucun montant n&apos;a été débité.</div>}
        {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}

        <section className="card plan-now" aria-label="Offre actuelle">
          <div>
            <div className="section-label">Offre actuelle</div>
            <div className="plan-now-name">{me.plan.name}</div>
            <div className="plan-now-meta">
              {max} prêt{max > 1 ? "s" : ""} en cours max{renewal && (me.user.cancelAtPeriodEnd ? ` · résilié, actif jusqu'au ${renewal}` : ` · renouvellement le ${renewal}`)}
            </div>
          </div>
          <div className="plan-now-actions">
            {me.user.stripeSubscriptionId && <button type="button" className="btn" disabled={!!busy} onClick={() => go("/api/billing/portal", {}, "portal")}><Icon name="card" size={15} />Factures et moyen de paiement</button>}
            {current !== "FREE" && !me.user.cancelAtPeriodEnd && !cancelStep && <button type="button" className="btn danger" disabled={!!busy} onClick={() => setCancelStep(true)}>Résilier votre contrat</button>}
          </div>
          <div className="plan-now-use">
            <div className="row"><span>Prêts en cours</span><span className="mono">{me.activeLoans} / {max}</span></div>
            <Meter value={me.activeLoans / Math.max(1, max)} tone={me.activeLoans >= max ? "full" : undefined} />
          </div>
        </section>

        {canceled && <div className="banner ok"><Icon name="check" size={16} />Résiliation enregistrée. Une confirmation t&apos;a été envoyée par e-mail.</div>}
        {cancelStep && (
          <section className="card danger-zone stack grow-in" aria-labelledby="cancel-title">
            <h2 id="cancel-title">Résilier votre contrat</h2>
            <table className="tbl kv"><tbody>
              <tr><td>Titulaire</td><td>{me.user.name} ({me.user.email})</td></tr>
              <tr><td>Contrat</td><td>Abonnement {me.plan.name} — {me.plan.priceLabel}</td></tr>
              <tr><td>Fin de l&apos;abonnement</td><td>{renewal ? `le ${renewal}, à la fin de la période déjà payée` : "immédiate"}</td></tr>
              <tr><td>Ensuite</td><td>Retour à l&apos;offre gratuite ({PLANS.FREE.maxLoans} prêt en cours). Aucun prélèvement supplémentaire. Tes prêts sont conservés.</td></tr>
            </tbody></table>
            <div className="row">
              <button type="button" className="btn danger solid" disabled={!!busy} onClick={cancel}>{busy === "cancel" ? <><Spinner />Un instant…</> : "Confirmer la résiliation"}</button>
              <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setCancelStep(false)}>Garder mon abonnement</button>
            </div>
          </section>
        )}
      </div>

      <div className="sec-head"><h2>Changer d&apos;offre</h2></div>
      <div className="consent">
        <label className="check">
          <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErr(""); }} />
          <span>J&apos;accepte les <Link href="/cgu#vente" target="_blank">conditions générales de vente</Link> et je demande que mon abonnement commence immédiatement. Je garde mon droit de rétractation de 14 jours, avec remboursement intégral.</span>
        </label>
      </div>
      <div className="plans" style={{ marginTop: 14 }}>
        {PAID_PLANS.map((id) => {
          const p = PLANS[id];
          const isCurrent = current === id;
          return (
            <div key={id} className={`plan ${isCurrent ? "current" : ""}`}>
              <div className="plan-name">{p.name}{id === "YEARLY_10" && <span className="tag brand">−50 % vs mensuel</span>}{isCurrent && <span className="tag">Actuelle</span>}</div>
              <div className="plan-price">{euros(p.priceCents)}<small>/ {p.interval === "month" ? "mois" : "an"}</small></div>
              <div className="plan-eq">{p.interval === "year" ? `soit ${euros(Math.round(p.priceCents / 12))} par mois` : "sans engagement"}</div>
              <ul>
                <li><Icon name="check" size={14} />{p.maxLoans} prêts en cours</li>
                <li><Icon name="check" size={14} />Rappels et relances automatiques</li>
                <li><Icon name="check" size={14} />Bilan et export CSV</li>
              </ul>
              <button type="button" className={`btn ${isCurrent ? "" : "primary"} block`} disabled={isCurrent || !!busy} onClick={() => choose(id)}>
                {busy === id ? <><Spinner />Redirection…</> : isCurrent ? "Offre actuelle" : "Continuer vers le paiement"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Prix TTC. {LEGAL.vatMention}. Paiement sécurisé par Stripe : carte bancaire, PayPal, Apple Pay, Google Pay. Abonnement renouvelé automatiquement, résiliable à tout moment depuis cette page.</p>
    </>
  );
}
