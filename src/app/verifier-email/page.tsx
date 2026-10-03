"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/AuthCard";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client";

export default function Page() {
  return <Suspense><Verify /></Suspense>;
}

/**
 * La confirmation demande un clic : certains antivirus de messagerie ouvrent les liens tout seuls,
 * une confirmation automatique au chargement validerait une adresse sans l'accord de son titulaire.
 */
function Verify() {
  const t = useSearchParams().get("t") || "";
  const { me, refresh } = useMe();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  async function confirm() {
    setState("busy"); setErr("");
    try {
      const { user } = await api<{ user: { email: string } }>("/api/auth/verify-email", { body: { t } });
      setEmail(user.email);
      setState("done");
      refresh();
    } catch (x) { setErr((x as Error).message); setState("idle"); }
  }

  return (
    <AuthCard title="Confirmer mon adresse e-mail" sub={state === "done" ? undefined : "Un clic pour confirmer que cette adresse est bien la tienne."}>
      {state === "done" ? (
        <div className="stack">
          <div className="banner ok" role="status"><Icon name="check" size={16} /><span>C&apos;est confirmé : <strong>{email}</strong> est l&apos;adresse de ton compte.</span></div>
          <Link href={me ? "/prets" : "/connexion"} className="btn primary lg block">{me ? "Ouvrir mes prêts" : "Se connecter"}</Link>
        </div>
      ) : (
        <div className="stack">
          {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
          <button type="button" className="btn primary lg block" disabled={state === "busy" || !t} onClick={confirm}>
            {state === "busy" ? <><Spinner />Un instant…</> : "Confirmer mon adresse"}
          </button>
          <p className="hint">Tu n&apos;as pas créé de compte Prêt Matériel ? Ferme simplement cette page : rien ne sera fait.</p>
        </div>
      )}
    </AuthCard>
  );
}
