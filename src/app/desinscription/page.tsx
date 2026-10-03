"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { LegalLinks } from "@/components/SiteFooter";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  return <Suspense><OptOut /></Suspense>;
}

function OptOut() {
  const sp = useSearchParams();
  const e = sp.get("e") || "";
  const t = sp.get("t") || "";
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function confirm() {
    setState("busy"); setErr("");
    try { await api("/api/optout", { body: { e, t } }); setState("done"); }
    catch (x) { setErr((x as Error).message); setState("idle"); }
  }

  return (
    <main className="auth single">
      <div className="auth-main">
        <Brand href="/" />
        <div className="auth-card">
          <div>
            <h1 className="auth-title">Ne plus recevoir d&apos;e-mails</h1>
            <p className="auth-sub">Adresse concernée : <strong style={{ color: "var(--ink)" }}>{e || "—"}</strong></p>
          </div>
          {state === "done" ? (
            <div className="banner ok"><Icon name="check" size={16} />C&apos;est fait. Prêt Matériel n&apos;enverra plus de rappels à cette adresse.</div>
          ) : (
            <div className="stack">
              {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}
              <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
                Vous ne recevrez plus aucun e-mail de rappel lié à un prêt enregistré par un utilisateur de Prêt Matériel. Les personnes qui vous ont prêté quelque chose ne seront pas prévenues.
              </p>
              <button type="button" className="btn primary lg block" disabled={state === "busy" || !e || !t} onClick={confirm}>
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
