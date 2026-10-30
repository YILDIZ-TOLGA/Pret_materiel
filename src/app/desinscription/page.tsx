"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { LegalLinks } from "@/components/SiteFooter";
import { DayNight, Spinner } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  return <Suspense><OptOut /></Suspense>;
}

function OptOut() {
  const sp = useSearchParams();
  // `e` : ancien format de lien (adresse en clair), encore accepté pour les e-mails déjà envoyés
  const e = sp.get("e") || "";
  const t = sp.get("t") || "";
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [masked, setMasked] = useState("");
  useEffect(() => {
    if (!t) return;
    api<{ email: string }>(`/api/optout?${new URLSearchParams(e ? { e, t } : { t })}`)
      .then((r) => setMasked(r.email))
      .catch((x) => setErr((x as Error).message));
  }, [e, t]);

  async function confirm() {
    setState("busy"); setErr("");
    try { await api("/api/optout", { body: e ? { e, t } : { t } }); setState("done"); }
    catch (x) { setErr((x as Error).message); setState("idle"); }
  }

  return (
    <main className="auth single">
      <div className="auth-main">
        <div className="auth-top"><Brand href="/" /><DayNight /></div>
        <div className="auth-card">
          <div>
            <h1 className="auth-title">Ne plus recevoir d&apos;e-mails</h1>
            <p className="auth-sub">Adresse concernée : <strong style={{ color: "var(--ink)" }}>{masked || "—"}</strong></p>
          </div>
          {state === "done" ? (
            <div className="banner ok"><Icon name="check" size={16} />C&apos;est fait. Prêt Matériel n&apos;enverra plus d&apos;e-mails à cette adresse.</div>
          ) : (
            <div className="stack">
              {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}
              <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
                Vous ne recevrez plus aucun e-mail lié à un prêt enregistré par un utilisateur de Prêt Matériel : ni demande de signature, ni copie des reçus, ni rappel. Les personnes qui vous ont prêté quelque chose ne reçoivent aucun message à ce sujet ; elles voient seulement que les e-mails ne sont plus possibles pour votre adresse et pourront vous remettre vos reçus autrement.
              </p>
              <button type="button" className="btn primary lg block" disabled={state === "busy" || !masked} onClick={confirm}>
                {state === "busy" ? <><Spinner />Un instant…</> : "Confirmer la désinscription"}
              </button>
            </div>
          )}
          <p className="hint" style={{ marginTop: 20 }}>Pour faire supprimer vos données, écrivez-nous : voir la <a href="/confidentialite">politique de confidentialité</a>.</p>
        </div>
        <div className="auth-foot"><LegalLinks /></div>
      </div>
    </main>
  );
}
