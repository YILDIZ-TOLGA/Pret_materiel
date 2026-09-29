"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/components/Providers";
import { api, dateFr } from "@/lib/client";
import { PLANS, PAID_PLANS } from "@/lib/plans";

export default function BillingPage() {
  return <AppShell><Suspense><Billing /></Suspense></AppShell>;
}

function Billing() {
  const { me, refresh } = useMe();
  const sp = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (sp.get("success")) refresh(); }, [sp, refresh]);
  if (!me) return null;

  async function go(path: string, body: object, key: string) {
    setBusy(key); setErr("");
    try { const { url } = await api(path, { body }); location.href = url; }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  }

  const current = me.plan.id;
  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Mon offre</h1>
      {sp.get("success") && <div className="alert good">Merci ! Ton abonnement est actif 🎉</div>}
      {sp.get("canceled") && <div className="alert warn">Paiement annulé, rien n&apos;a été débité.</div>}
      {err && <div className="alert bad">{err}</div>}

      <div className="card row">
        <div>
          <div className="muted small">Offre actuelle</div>
          <strong style={{ fontSize: 20 }}>{me.plan.name}</strong>
          <div className="small muted">{me.plan.maxLoans} prêt{me.plan.maxLoans > 1 ? "s" : ""} en cours max{me.user.planExpiresAt && current !== "FREE" && ` · renouvellement le ${dateFr(me.user.planExpiresAt)}`}</div>
        </div>
        <span className="spacer" />
        {me.user.stripeSubscriptionId && <button className="btn" disabled={!!busy} onClick={() => go("/api/billing/portal", {}, "portal")}>Gérer / résilier</button>}
      </div>

      <div className="plans">
        {PAID_PLANS.map((id) => {
          const p = PLANS[id];
          const isCurrent = current === id;
          return (
            <div key={id} className={`card plan ${isCurrent ? "current" : ""}`}>
              <div className="row"><strong>{p.name}</strong>{id === "YEARLY_10" && <span className="badge good">-50 %</span>}{isCurrent && <span className="badge accent">Actuelle</span>}</div>
              <div className="price">{p.priceLabel}</div>
              <div className="muted small" style={{ flex: 1 }}>{p.tagline}</div>
              <button className={`btn ${isCurrent ? "" : "primary"} block`} disabled={isCurrent || !!busy} onClick={() => go("/api/billing/checkout", { plan: id }, id)}>
                {busy === id ? "…" : isCurrent ? "Offre actuelle" : "Choisir"}
              </button>
            </div>
          );
        })}
      </div>
      <p className="tiny muted center">Paiement sécurisé par Stripe : carte, PayPal, Apple Pay, Google Pay. Mensuel sans engagement, résiliable en 1 clic.</p>
    </div>
  );
}
