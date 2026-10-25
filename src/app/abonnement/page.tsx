"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { IntervalToggle, PlanCard } from "@/components/PlanCards";
import { useMe } from "@/components/Providers";
import { Meter, PageHeader, Spinner } from "@/components/ui";
import { api, dateFr, euros } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import type { Plan } from "@prisma/client";
import { PLANS, TIERS, yearlySaving, type Interval } from "@/lib/plans";

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
  const [picked, setPeriod] = useState<Interval | null>(null);
  const [withdrawStep, setWithdrawStep] = useState(false);
  const [withdrawn, setWithdrawn] = useState<{ refundedCents: number; refundOk: boolean } | null>(null);
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

  async function withdraw() {
    setBusy("withdraw"); setErr("");
    try {
      const r = await api<{ refundedCents: number; refundOk: boolean }>("/api/billing/withdraw", { method: "POST" });
      await refresh(); setWithdrawStep(false); setWithdrawn(r);
    } catch (e) { setErr((e as Error).message); }
    setBusy(null);
  }

  function choose(id: string) {
    if (!accept) { setErr("Coche la case d'acceptation des conditions générales de vente pour continuer."); return; }
    go("/api/billing/checkout", { plan: id, acceptSalesTerms: true }, id);
  }

  const current = me.plan.id as Plan;
  // la bascule s'ouvre sur la période de l'offre actuelle
  const period = picked ?? (PLANS[current].interval === "year" ? "year" : "month");
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

        {withdrawn && (
          <div className="banner ok" role="status"><Icon name="check" size={16} />
            <span>Rétractation enregistrée : ton abonnement est arrêté.{" "}
              {withdrawn.refundOk && withdrawn.refundedCents > 0 ? `${euros(withdrawn.refundedCents)} te seront remboursés sur ton moyen de paiement.` : "Ton remboursement sera fait sous 14 jours."}
              {" "}Un accusé de réception t&apos;a été envoyé par e-mail.</span>
          </div>
        )}
        {/* Fonction de rétractation (directive 2023/2673) : visible tant que le délai de 14 jours court */}
        {me.withdrawalUntil && !withdrawn && (
          <section className="card stack" aria-labelledby="withdraw-title">
            <h2 id="withdraw-title">Droit de rétractation</h2>
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              Jusqu&apos;au {dateFr(me.withdrawalUntil)} inclus, tu peux te rétracter sans te justifier : l&apos;abonnement s&apos;arrête tout de suite et tu es remboursé intégralement.
            </p>
            {!withdrawStep ? (
              <div><button type="button" className="btn" disabled={!!busy} onClick={() => setWithdrawStep(true)}>Se rétracter du contrat ici</button></div>
            ) : (
              <div className="stack grow-in">
                <table className="tbl kv"><tbody>
                  <tr><td>Titulaire</td><td>{me.user.name} ({me.user.email})</td></tr>
                  <tr><td>Contrat</td><td>Abonnement {me.plan.name} — {me.plan.priceLabel}</td></tr>
                  <tr><td>Effet</td><td>Arrêt immédiat, retour à l&apos;offre gratuite. Tes prêts sont conservés.</td></tr>
                  <tr><td>Remboursement</td><td>Intégral, sur le moyen de paiement utilisé, sous 14 jours au plus</td></tr>
                  <tr><td>Accusé de réception</td><td>Envoyé à {me.user.email}</td></tr>
                </tbody></table>
                <div className="row">
                  <button type="button" className="btn danger solid" disabled={!!busy} onClick={withdraw}>{busy === "withdraw" ? <><Spinner />Un instant…</> : "Confirmer la rétractation"}</button>
                  <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setWithdrawStep(false)}>Annuler</button>
                </div>
              </div>
            )}
          </section>
        )}

        {canceled && <div className="banner ok"><Icon name="check" size={16} />Résiliation enregistrée. Une confirmation t&apos;a été envoyée par e-mail.</div>}
        {cancelStep && (
          <section className="card danger-zone stack grow-in" aria-labelledby="cancel-title">
            <h2 id="cancel-title">Résilier votre contrat</h2>
            <table className="tbl kv"><tbody>
              <tr><td>Titulaire</td><td>{me.user.name} ({me.user.email})</td></tr>
              <tr><td>Contrat</td><td>Abonnement {me.plan.name} — {me.plan.priceLabel}</td></tr>
              <tr><td>Fin de l&apos;abonnement</td><td>{renewal ? `le ${renewal}, à la fin de la période déjà payée` : "immédiate"}</td></tr>
              <tr><td>Ensuite</td><td>Retour à l&apos;offre gratuite ({PLANS.FREE.maxLoans} prêt{PLANS.FREE.maxLoans > 1 ? "s" : ""} en cours). Aucun prélèvement supplémentaire. Tes prêts sont conservés.</td></tr>
            </tbody></table>
            <div className="row">
              <button type="button" className="btn danger solid" disabled={!!busy} onClick={cancel}>{busy === "cancel" ? <><Spinner />Un instant…</> : "Confirmer la résiliation"}</button>
              <button type="button" className="btn ghost" disabled={!!busy} onClick={() => setCancelStep(false)}>Garder mon abonnement</button>
            </div>
          </section>
        )}
      </div>

      {me.site?.mode === "BETA" ? (
        <section className="card stack" style={{ marginTop: 24 }} aria-labelledby="beta-title">
          <h2 id="beta-title">Phase de test : tout est gratuit</h2>
          <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
            Pendant la phase de test, {me.plan.maxLoans} prêts en cours sont possibles sans payer, et aucune offre n&apos;est en vente.
            {me.site.paidFrom
              ? <> Le site passe en mode payant le <strong>{dateFr(me.site.paidFrom)}</strong> : tu gardes tous tes prêts, tu peux toujours les consulter, les modifier et les clôturer. Au-delà de {PLANS.FREE.maxLoans} prêts en cours, il faudra une offre pour en créer de nouveaux.</>
              : <> Si le site passe un jour en mode payant, tu seras prévenu par e-mail au moins 30 jours avant, et rien ne sera supprimé.</>}
          </p>
          <p className="hint">Les offres prévues : <Link href="/#tarifs">voir les tarifs</Link>.</p>
        </section>
      ) : <>
      <div className="sec-head"><h2>Changer d&apos;offre</h2></div>
      <div className="consent">
        <label className="check">
          <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErr(""); }} />
          <span>J&apos;accepte les <Link href="/cgu#vente" target="_blank">conditions générales de vente</Link> (pour une offre Pro, avec l&apos;<Link href="/cgu#sous-traitance" target="_blank">accord de sous-traitance des données</Link>) et je demande que mon abonnement commence immédiatement. Je garde mon droit de rétractation de 14 jours, avec remboursement intégral.</span>
        </label>
      </div>
      <div className="plans-bar" style={{ marginTop: 14 }}><IntervalToggle value={period} onChange={setPeriod} /></div>
      <div className="plans">
        {TIERS.map((t) => {
          const id = t[period];
          const isCurrent = current === id;
          return (
            <PlanCard key={t.id} plan={id} title={t.name} audience={t.audience} pro={t.pro} tag={period === "year" ? yearlySaving(t) : null} current={isCurrent}>
              <button type="button" className={`btn ${isCurrent ? "" : "primary"} block`} disabled={isCurrent || !!busy} onClick={() => choose(id)}>
                {busy === id ? <><Spinner />Redirection…</> : isCurrent ? "Offre actuelle" : "Continuer vers le paiement"}
              </button>
            </PlanCard>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Prix TTC. {LEGAL.vatMention}. Paiement sécurisé par Stripe : carte bancaire, PayPal, Apple Pay, Google Pay. Abonnement renouvelé automatiquement, résiliable à tout moment depuis cette page.</p>
      </>}
    </>
  );
}
