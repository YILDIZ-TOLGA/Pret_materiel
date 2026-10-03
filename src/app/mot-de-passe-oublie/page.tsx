"use client";
import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import { RETENTION } from "@/lib/legal";

export default function Page() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErr("");
    try { await api("/api/auth/forgot-password", { body: { email } }); setState("done"); }
    catch (x) { setErr((x as Error).message); setState("idle"); }
  }

  return (
    <AuthCard title="Mot de passe oublié" sub="Indique l'adresse e-mail de ton compte : tu recevras un lien pour choisir un nouveau mot de passe.">
      {state === "done" ? (
        <div className="stack">
          <div className="banner ok" role="status"><Icon name="mail" size={16} />
            <span>Si un compte existe pour <strong>{email}</strong>, un lien vient d&apos;y être envoyé. Il est valable {RETENTION.resetPasswordLinkHours} heure. Pense à regarder dans les courriers indésirables.</span>
          </div>
          <p className="auth-switch"><Link href="/connexion">Retour à la connexion</Link></p>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
          <label className="field">Adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
          <button className="btn primary lg block" disabled={state === "busy"}>{state === "busy" ? <><Spinner />Envoi…</> : "Recevoir le lien"}</button>
          <p className="auth-switch"><Link href="/connexion">Retour à la connexion</Link></p>
        </form>
      )}
    </AuthCard>
  );
}
