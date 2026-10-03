"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { useMe } from "./Providers";
import { LegalLinks } from "./SiteFooter";
import { Spinner, Stamp } from "./ui";

/** Règle CNIL appliquée côté serveur (src/lib/validation.ts) : 8 caractères et 3 types sur 4. */
function pwChecks(pw: string) {
  const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  return { length: pw.length >= 8, types: types >= 3 };
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/prets";
  const { refresh } = useMe();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const register = mode === "register";
  const checks = pwChecks(form.password);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { token } = await api<{ token: string }>(`/api/auth/${mode}`, { body: register ? { ...form, acceptTerms: accept } : form });
      try { localStorage.setItem("token", token); } catch {}
      await refresh();
      router.replace(next.startsWith("/") ? next : "/prets");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-main">
        <Brand href="/" />
        <div className="auth-card">
          <div>
            <h1 className="auth-title">{register ? "Ouvre ton carnet." : "Bon retour."}</h1>
            <p className="auth-sub">{register ? "Gratuit pour un prêt en cours. Sans carte bancaire." : "Retrouve tes prêts, tes rappels et ton bilan."}</p>
          </div>
          <form className="stack" onSubmit={submit}>
            {err && <div className="banner late"><Icon name="alert" size={16} />{err}</div>}
            {register && <label className="field">Prénom<input value={form.name} onChange={set("name")} required autoComplete="given-name" autoFocus /></label>}
            <label className="field">Adresse e-mail<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" autoFocus={!register} /></label>
            <div className="field">
              <label htmlFor="pw">Mot de passe</label>
              <div className="pw">
                <input id="pw" type={show ? "text" : "password"} value={form.password} onChange={set("password")} required minLength={register ? 8 : 1}
                  autoComplete={register ? "new-password" : "current-password"} aria-describedby={register ? "pw-rules" : undefined} />
                <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
                  <Icon name={show ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
              {register && (
                <ul className="criteria" id="pw-rules">
                  <li className={checks.length ? "ok" : ""}><span className="c"><Icon name="check" size={9} stroke={3.4} /></span>8 caractères minimum</li>
                  <li className={checks.types ? "ok" : ""}><span className="c"><Icon name="check" size={9} stroke={3.4} /></span>3 types parmi : minuscules, majuscules, chiffres, caractères spéciaux</li>
                </ul>
              )}
            </div>
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
