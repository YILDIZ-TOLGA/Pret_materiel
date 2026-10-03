"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard, PasswordField } from "@/components/AuthCard";
import { Icon } from "@/components/Icon";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  return <Suspense><Reset /></Suspense>;
}

function Reset() {
  const t = useSearchParams().get("t") || "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy"); setErr("");
    try {
      await api("/api/auth/reset-password", { body: { t, password } });
      // L'ancienne session de cet appareil a été fermée côté serveur
      try { localStorage.removeItem("token"); } catch {}
      setState("done");
    } catch (x) { setErr((x as Error).message); setState("idle"); }
  }

  if (!t) {
    return (
      <AuthCard title="Lien incomplet" sub="Ouvre le lien reçu par e-mail en entier, ou demande-en un nouveau.">
        <Link href="/mot-de-passe-oublie" className="btn primary lg block">Demander un nouveau lien</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Nouveau mot de passe" sub={state === "done" ? undefined : "Choisis le mot de passe que tu utiliseras désormais."}>
      {state === "done" ? (
        <div className="stack">
          <div className="banner ok" role="status"><Icon name="check" size={16} />Mot de passe modifié. Tous tes appareils ont été déconnectés.</div>
          <Link href="/connexion" className="btn primary lg block">Se connecter</Link>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {err && (
            <div className="banner late" role="alert"><Icon name="alert" size={16} />
              <span>{err} {err.includes("plus valable") && <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>}</span>
            </div>
          )}
          <PasswordField id="pw" label="Nouveau mot de passe" value={password} onChange={setPassword} isNew autoFocus />
          <button className="btn primary lg block" disabled={state === "busy"}>{state === "busy" ? <><Spinner />Enregistrement…</> : "Enregistrer le mot de passe"}</button>
        </form>
      )}
    </AuthCard>
  );
}
