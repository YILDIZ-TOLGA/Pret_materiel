"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, saveAuthToken } from "@/lib/client";
import { PLANS } from "@/lib/plans";
import { useSite } from "./SiteMode";
import { PasswordField } from "./AuthCard";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { useMe } from "./Providers";
import { LegalLinks } from "./SiteFooter";
import { DayNight, Spinner, Stamp } from "./ui";

/**
 * Page où revenir après la connexion : seulement un chemin de ce site. « //site.com » ou « /\site.com »
 * commencent aussi par « / » mais mènent ailleurs (redirection ouverte, utile pour l'hameçonnage).
 */
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/prets";
  try {
    return new URL(next, location.origin).origin === location.origin ? next : "/prets";
  } catch {
    return "/prets";
  }
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { refresh } = useMe();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const register = mode === "register";
  const site = useSite();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { token } = await api<{ token: string }>(`/api/auth/${mode}`, { body: register ? { ...form, acceptTerms: accept } : form });
      saveAuthToken(token);
      await refresh();
      router.replace(safeNext(next));
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-main">
        <div className="auth-top"><Brand href="/" /><DayNight /></div>
        <div className="auth-card">
          <div>
            <h1 className="auth-title">{register ? "Ouvre ton carnet." : "Bon retour."}</h1>
            <p className="auth-sub">{register ? (site?.mode === "BETA" ? "Gratuit pendant la phase de test. Sans carte bancaire." : `Gratuit jusqu'à ${PLANS.FREE.maxLoans} prêts en cours. Sans carte bancaire.`) : "Retrouve tes prêts, tes rappels et ton bilan."}</p>
          </div>
          <form className="stack" onSubmit={submit}>
            {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}
            {register && <label className="field">Prénom<input value={form.name} onChange={set("name")} required autoComplete="given-name" autoFocus /></label>}
            <label className="field">Adresse e-mail<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus={!register} /></label>
            <PasswordField id="pw" label="Mot de passe" value={form.password} onChange={(password) => setForm({ ...form, password })} isNew={register} />
            {!register && <p className="hint" style={{ marginTop: -6 }}><Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link></p>}
            {register && (
              <label className="check">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
                <span>J&apos;ai au moins 15 ans, j&apos;accepte les <Link href="/cgu" target="_blank">conditions générales</Link> et j&apos;ai lu la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span>
              </label>
            )}
            <button className="btn primary lg block" disabled={busy}>{busy ? <><Spinner />Un instant…</> : register ? "Créer mon compte" : "Se connecter"}</button>
          </form>
          <p className="auth-switch">
            {register ? <>Déjà inscrit ? <Link href="/connexion">Se connecter</Link></> : <>Pas encore de compte ? <Link href="/inscription">Créer un compte</Link></>}
          </p>
        </div>
        <div className="auth-foot"><LegalLinks /></div>
      </div>

      <aside className="auth-aside" aria-hidden="true">
        <p className="auth-quote">« Tu me la rends quand&nbsp;? » <em>Tu n&apos;auras plus à le demander.</em></p>
        <div className="fiche">
          <div className="fiche-part fiche-head">
            <div className="fiche-top"><span>Fiche n° 0142</span><span className="sep">/</span><span>Objet</span></div>
            <div className="fiche-title" style={{ fontSize: 38 }}>Perceuse Bosch</div>
            <div className="fiche-state"><span className="due done">Rendu</span><span>Rendu avec un jour d&apos;avance</span></div>
            <div className="fiche-stamp"><Stamp state="in">Rendu</Stamp></div>
          </div>
          <div className="fiche-part fiche-body">
            <dl className="fiche-grid">
              <div><dt>Emprunteur</dt><dd>Léa</dd></div>
              <div><dt>Retour prévu</dt><dd className="mono">26 sept.</dd></div>
            </dl>
          </div>
        </div>
        <ul className="auth-points">
          <li><Icon name="mail" size={16} />Rappel la veille, relance en cas de retard</li>
          <li><Icon name="banknote" size={16} />Objets et argent, remboursements partiels</li>
          <li><Icon name="chart" size={16} />Bilan par personne, export CSV</li>
        </ul>
      </aside>
    </main>
  );
}
