"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { PlanCard } from "@/components/PlanCards";
import { useMe } from "@/components/Providers";
import { Meter, PageHeader, Spinner } from "@/components/ui";
import { api, dateFr, euros } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import type { Plan } from "@prisma/client";
import { MAIN_PLAN } from "@/lib/plans";

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
  const renewal = me.user.planExpiresAt && current !== "FREE" ? dateFr(me.user.planExpiresAt) : null;
  const max = me.plan.maxLoans;
  return (
    <>
      <PageHeader title="Offre" sub={`Une seule offre pour les professionnels : ${MAIN_PLAN.priceLabel}, résiliable à tout moment.`} />
      <div className="stack">
        {sp.get("success") && <div className="banner ok"><Icon name="check" size={16} />Paiement confirmé. Ton abonnement est actif.</div>}
        {sp.get("canceled") && <div className="banner soon"><Icon name="info" size={16} />Paiement annulé. Aucun montant n&apos;a été débité.</div>}
        {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}

        <section className="card plan-now" aria-label="Offre actuelle">
          <div>
            <div className="section-label">Offre actuelle</div>
            <div className="plan-now-name">{me.plan.name}</div>
            <div className="plan-now-meta">
              {max > 0 ? `${max.toLocaleString("fr-FR")} prêts en cours max` : "Tes prêts restent consultables ; un abonnement est nécessaire pour en enregistrer de nouveaux"}
              {renewal && (me.user.cancelAtPeriodEnd ? ` · résilié, actif jusqu'au ${renewal}` : ` · renouvellement le ${renewal}`)}
            </div>
          </div>
          <div className="plan-now-actions">
            {me.user.stripeSubscriptionId && <button type="button" className="btn" disabled={!!busy} onClick={() => go("/api/billing/portal", {}, "portal")}><Icon name="card" size={15} />Factures et moyen de paiement</button>}
            {current !== "FREE" && !me.user.cancelAtPeriodEnd && !cancelStep && <button type="button" className="btn danger" disabled={!!busy} onClick={() => setCancelStep(true)}>Résilier votre contrat</button>}
          </div>
          {max > 0 && (
            <div className="plan-now-use">
              <div className="row"><span>Prêts en cours</span><span className="mono">{me.activeLoans} / {max}</span></div>
              <Meter value={me.activeLoans / max} tone={me.activeLoans >= max ? "full" : undefined} />
            </div>
          )}
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
                  <tr><td>Effet</td><td>Arrêt immédiat de l&apos;abonnement. Tes prêts et tes documents signés sont conservés.</td></tr>
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
              <tr><td>Ensuite</td><td>Aucun prélèvement supplémentaire. Tes prêts et tes documents signés restent consultables ; tu ne pourras plus en enregistrer de nouveaux sans te réabonner.</td></tr>
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
            Pendant la phase de test, {me.plan.maxLoans} prêts en cours sont possibles sans payer, accusés de réception et reçus signés compris, et rien n&apos;est vendu.
            {me.site.paidFrom
              ? <> Le site passe en mode payant le <strong>{dateFr(me.site.paidFrom)}</strong> : tu gardes tous tes prêts et tes documents, tu peux toujours les consulter, les modifier et les clôturer. Pour en enregistrer de nouveaux, il faudra l&apos;offre {MAIN_PLAN.name} ({MAIN_PLAN.priceLabel}).</>
              : <> Ensuite, l&apos;offre {MAIN_PLAN.name} coûtera {MAIN_PLAN.priceLabel}. Tu seras prévenu par e-mail au moins 30 jours avant, et rien ne sera supprimé.</>}
          </p>
          <p className="hint">Ce que comprend l&apos;offre : <Link href="/#tarifs">voir le tarif</Link>.</p>
        </section>
      ) : <>
      <div className="sec-head"><h2>{current === MAIN_PLAN.id ? "Ton abonnement" : "S'abonner"}</h2></div>
      <div className="plans solo">
        <PlanCard plan={MAIN_PLAN.id} current={current === MAIN_PLAN.id} featured>
          {current !== MAIN_PLAN.id && (
            <label className="check small" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErr(""); }} />
              <span>J&apos;accepte, pour le compte de ma structure, les <Link href="/cgu#vente" target="_blank">conditions générales de vente</Link> et l&apos;<Link href="/cgu#sous-traitance" target="_blank">accord de sous-traitance des données</Link>, et je demande que l&apos;abonnement commence immédiatement. La rétractation reste possible 14 jours, avec remboursement intégral.</span>
            </label>
          )}
          <button type="button" className={`btn ${current === MAIN_PLAN.id ? "" : "primary"} block`} disabled={current === MAIN_PLAN.id || !!busy} onClick={() => choose(MAIN_PLAN.id)}>
            {busy === MAIN_PLAN.id ? <><Spinner />Redirection…</> : current === MAIN_PLAN.id ? "Offre actuelle" : `S'abonner : ${MAIN_PLAN.priceLabel}`}
          </button>
        </PlanCard>
      </div>
      <p className="hint" style={{ marginTop: 16 }}>Prix hors taxes. {LEGAL.vatMention}. Paiement sécurisé par Stripe : carte bancaire, prélèvement SEPA, PayPal, Apple Pay, Google Pay. Abonnement annuel reconduit automatiquement (tu es prévenu par e-mail un à trois mois avant), résiliable à tout moment depuis cette page.</p>
      </>}
    </>
  );
}
