"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, saveAuthToken } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import { MAIN_PLAN } from "@/lib/plans";
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
  const [form, setForm] = useState({ name: "", organization: "", email: "", password: "" });
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
      const { token } = await api<{ token: string }>(`/api/auth/${mode}`, { body: register ? { ...form, acceptTerms: accept } : { email: form.email, password: form.password } });
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
            <h1 className="auth-title">{register ? "Ouvre ton registre." : "Bon retour."}</h1>
            <p className="auth-sub">{register ? (site?.mode === "BETA" ? "Pour les entreprises et les associations. Gratuit pendant la phase de test, sans carte bancaire." : `Pour les entreprises et les associations. Offre ${MAIN_PLAN.name} : ${MAIN_PLAN.priceLabel}.`) : "Retrouve tes prêts, tes documents signés et ton bilan."}</p>
          </div>
          <form className="stack" onSubmit={submit}>
            {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}
            {register && <label className="field">Nom de la structure<input value={form.organization} onChange={set("organization")} required maxLength={120} autoComplete="organization" autoFocus placeholder="Entreprise, association, collectivité…" /></label>}
            {register && <label className="field">Ton prénom et ton nom<input value={form.name} onChange={set("name")} required maxLength={80} autoComplete="name" /></label>}
            <label className="field">Adresse e-mail<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus={!register} /></label>
            <PasswordField id="pw" label="Mot de passe" value={form.password} onChange={(password) => setForm({ ...form, password })} isNew={register} />
            {!register && <p className="hint" style={{ marginTop: -6 }}><Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link></p>}
            {register && (
              <label className="check">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} required />
                <span>J&apos;ouvre ce compte pour une entreprise, une association ou un autre organisme, dans le cadre de son activité, j&apos;ai au moins {LEGAL.minAge} ans, j&apos;accepte les <Link href="/cgu" target="_blank">conditions générales</Link> et j&apos;ai lu la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span>
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
        <p className="auth-quote">« Je l&apos;ai bien rendu. » <em>Désormais, c&apos;est signé.</em></p>
        <div className="fiche">
          <div className="fiche-part fiche-head">
            <div className="fiche-top"><span>Fiche n° 0142</span><span className="sep">/</span><span>Matériel</span></div>
            <div className="fiche-title" style={{ fontSize: 38 }}>Perforateur Hilti</div>
            <div className="fiche-state"><span className="due done">Rendu</span><span>Attestation de retour signée</span></div>
            <div className="fiche-stamp"><Stamp state="in">Rendu</Stamp></div>
          </div>
          <div className="fiche-part fiche-body">
            <dl className="fiche-grid">
              <div><dt>Emprunteur</dt><dd>Léa Martin</dd></div>
              <div><dt>Accusé signé</dt><dd className="mono">12 sept.</dd></div>
            </dl>
          </div>
        </div>
        <ul className="auth-points">
          <li><Icon name="signature" size={16} />Accusé de réception signé en ligne par l&apos;emprunteur</li>
          <li><Icon name="printer" size={16} />Reçus de remboursement et de retour en PDF</li>
          <li><Icon name="mail" size={16} />Rappel la veille, relance en cas de retard</li>
        </ul>
      </aside>
    </main>
  );
}
