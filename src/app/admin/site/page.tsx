"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useConfirm } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { useToast } from "@/components/Toast";
import { SkeletonRows, Spinner } from "@/components/ui";
import { api, dateFr } from "@/lib/client";
import { PLANS } from "@/lib/plans";

type State = {
  mode: "BETA" | "PAID"; paidFrom: string | null; paidSince: string | null; updatedAt: string;
  updatedBy: { name: string; email: string } | null;
  earliestPaidDay: string; noticeDays: number; betaLimits: { maxLoans: number; maxNewLoansPerDay: number }; paymentReady: boolean;
  stats: { users: number; verified: number; noticed: number; overFreeCap: number; paying: number; stripeSubscriptions: number };
};

/**
 * Mode du site : « site testeur » (tout gratuit, pour fidéliser les premiers utilisateurs) ou « site payant ».
 * Le passage au payant se programme au moins 30 jours à l'avance et ne supprime rien.
 */
export default function SiteModePage() {
  const { refresh } = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const [s, setS] = useState<State | null>(null);
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<State>("/api/admin/site").then((r) => { setS(r); setDay((d) => d || r.earliestPaidDay); }), []);
  useEffect(() => { load(); }, [load]);

  async function send(body: object, done: string) {
    setBusy(true);
    try { setS(await api<State>("/api/admin/site", { body })); await refresh(); toast.show({ text: done }); }
    catch (e) { toast.show({ tone: "error", text: (e as Error).message }); }
    setBusy(false);
  }

  async function schedule() {
    const ok = await confirm({
      title: `Passer en site payant le ${dateFr(day)} ?`,
      body: <>Les {s!.stats.verified} utilisateurs dont l&apos;adresse est confirmée seront prévenus par e-mail et dans l&apos;appli. Rien ne sera supprimé ; à cette date, {s!.stats.overFreeCap} compte{s!.stats.overFreeCap > 1 ? "s" : ""} dépassant l&apos;offre gratuite ne pourra plus créer de prêt sans offre.</>,
      confirmLabel: "Programmer et prévenir",
      icon: "card",
    });
    if (ok) send({ action: "schedule", day }, `Passage au mode payant programmé le ${dateFr(day)}`);
  }

  async function backToBeta() {
    const ok = await confirm({
      title: "Repasser en site testeur ?",
      body: <>Tout redevient gratuit immédiatement et plus aucune offre n&apos;est vendue.{s!.stats.stripeSubscriptions > 0 && <> <strong>{s!.stats.stripeSubscriptions} abonnement{s!.stats.stripeSubscriptions > 1 ? "s" : ""} Stripe continuera d&apos;être prélevé</strong> : résilie-les ou rembourse-les depuis le tableau de bord Stripe si tu veux que ce soit vraiment gratuit pour tout le monde.</>}</>,
      confirmLabel: "Repasser en site testeur",
      danger: s!.stats.stripeSubscriptions > 0,
      icon: "undo",
    });
    if (ok) send({ action: "beta" }, "Le site est repassé en site testeur");
  }

  if (!s) return <><AdminNav /><SkeletonRows n={4} /></>;
  const beta = s.mode === "BETA";
  return (
    <>
      <AdminNav />
      <div className="stack">
        <section className="card stack" aria-labelledby="mode-title">
          <div className="section-label">Mode actuel</div>
          <h2 id="mode-title" className="plan-now-name" style={{ margin: 0 }}>{beta ? "Site testeur : tout est gratuit" : "Site payant"}</h2>
          <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
            {beta
              ? <>Chaque compte a jusqu&apos;à {s.betaLimits.maxLoans} prêts en cours et {s.betaLimits.maxNewLoansPerDay} nouveaux prêts par jour, sans payer. Aucune offre n&apos;est vendue. Les garde-fous anti-abus restent actifs.</>
              : <>Offres et limites normales : l&apos;offre gratuite permet {PLANS.FREE.maxLoans} prêts en cours ; au-delà, il faut une offre pour en créer de nouveaux. Rien n&apos;est jamais supprimé.{s.paidSince && <> Payant depuis le {dateFr(s.paidSince)}.</>}</>}
          </p>
          <table className="tbl kv"><tbody>
            <tr><td>Utilisateurs</td><td className="mono">{s.stats.users} (dont {s.stats.verified} avec adresse confirmée)</td></tr>
            <tr><td>Au-delà de l&apos;offre gratuite</td><td className="mono">{s.stats.overFreeCap} compte{s.stats.overFreeCap > 1 ? "s" : ""} avec plus de {PLANS.FREE.maxLoans} prêts en cours</td></tr>
            <tr><td>Abonnés payants</td><td className="mono">{s.stats.paying}{s.stats.stripeSubscriptions ? ` (dont ${s.stats.stripeSubscriptions} prélevés par Stripe)` : ""}</td></tr>
            <tr><td>Dernier changement</td><td>{dateFr(s.updatedAt)}{s.updatedBy && ` par ${s.updatedBy.name}`}</td></tr>
          </tbody></table>
        </section>

        {beta && !s.paidFrom && (
          <section className="card stack" aria-labelledby="paid-title">
            <h2 id="paid-title">Passer en site payant</h2>
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              Le changement est annoncé à tous les utilisateurs par e-mail et dans l&apos;appli, au moins {s.noticeDays} jours avant (CGU, article 10). À la date choisie, les offres payantes s&apos;ouvrent : chacun garde tous ses prêts, mais au-delà de {PLANS.FREE.maxLoans} prêts en cours il faudra une offre pour en créer de nouveaux.
            </p>
            {!s.paymentReady && <div className="banner late"><Icon name="alert" size={16} />Le paiement n&apos;est pas configuré (clés Stripe et prix des 6 offres) : impossible de programmer le passage au payant pour l&apos;instant.</div>}
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="field" style={{ minWidth: 220 }}>Date du passage au payant
                <input type="date" value={day} min={s.earliestPaidDay} onChange={(e) => setDay(e.target.value)} />
              </label>
              <button type="button" className="btn primary" disabled={busy || !s.paymentReady || !day || day < s.earliestPaidDay} onClick={schedule}>
                {busy ? <><Spinner />Un instant…</> : "Programmer le passage au payant"}
              </button>
            </div>
            <p className="hint">Au plus tôt le {dateFr(s.earliestPaidDay)}.</p>
          </section>
        )}

        {beta && s.paidFrom && (
          <section className="card stack" aria-labelledby="planned-title">
            <h2 id="planned-title">Passage au payant programmé le {dateFr(s.paidFrom)}</h2>
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              Annonce envoyée à {s.stats.noticed} utilisateur{s.stats.noticed > 1 ? "s" : ""} sur {s.stats.verified} (les e-mails partent par lots toutes les heures). Jusqu&apos;à cette date, tout reste gratuit.
            </p>
            <div><button type="button" className="btn" disabled={busy} onClick={() => send({ action: "cancel" }, "Passage au payant annulé : le site reste en site testeur")}>Annuler le passage au payant</button></div>
          </section>
        )}

        {!beta && (
          <section className="card stack" aria-labelledby="beta-title">
            <h2 id="beta-title">Repasser en site testeur</h2>
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              Tout redevient gratuit tout de suite (c&apos;est plus favorable aux utilisateurs, donc sans préavis). Les abonnements Stripe en cours ne sont pas arrêtés automatiquement.
            </p>
            <div><button type="button" className="btn" disabled={busy} onClick={backToBeta}>Repasser en site testeur</button></div>
          </section>
        )}
      </div>
    </>
  );
}
