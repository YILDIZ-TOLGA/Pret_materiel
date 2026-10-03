"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/AuthCard";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { LegalLinks } from "@/components/SiteFooter";
import { Avatar, PageHeader, Spinner, ThemeSwitch } from "@/components/ui";
import { API_BASE, api, dateFr } from "@/lib/client";

export default function AccountPage() {
  const { me, refresh } = useMe();
  const [name, setName] = useState(me?.user.name ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  if (!me) return null;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy("name"); setErr(""); setSaved(false);
    try { await api("/api/account", { method: "PATCH", body: { name } }); await refresh(); setSaved(true); }
    catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function exportData() {
    setBusy("export"); setErr("");
    try {
      let token: string | null = null;
      try { token = localStorage.getItem("token"); } catch {}
      const res = await fetch(`${API_BASE}/api/account/export`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("Export impossible, réessaie");
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: `pret-materiel-mes-donnees-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (x) { setErr((x as Error).message); }
    setBusy(null);
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy("delete"); setErr("");
    try {
      await api("/api/account", { method: "DELETE", body: { password } });
      try { localStorage.removeItem("token"); } catch {}
      location.href = "/";
    } catch (x) { setErr((x as Error).message); setBusy(null); }
  }

  const paid = me.plan.id !== "FREE" && !me.user.cancelAtPeriodEnd;
  return (
    <>
      <PageHeader title="Mon compte" sub="Tes informations personnelles et tes données." />
      {err && <div className="banner late" style={{ marginBottom: 20 }}><Icon name="alert" size={16} />{err}</div>}

      <div className="settings">
        <section className="set-row">
          <div className="set-label"><h2>Profil</h2><p>Ton prénom apparaît dans les e-mails envoyés à tes emprunteurs.</p></div>
          <form className="card stack" onSubmit={saveName}>
            <div className="row" style={{ gap: 14 }}>
              <Avatar name={name || me.user.name} size="lg" />
              <div style={{ minWidth: 0 }}><b>{me.user.name}</b><div className="small muted truncate">{me.user.email}</div></div>
            </div>
            <label className="field">Prénom<input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} required maxLength={80} autoComplete="given-name" /></label>
            <div className="row">
              <button className="btn" disabled={busy === "name" || name.trim() === me.user.name}>{busy === "name" ? <><Spinner />Enregistrement…</> : "Enregistrer"}</button>
              {saved && <span className="small ok-text row grow-in" style={{ gap: 6 }}><Icon name="check" size={14} />Enregistré</span>}
            </div>
            <p className="hint">Compte créé le {dateFr(me.user.createdAt)}{me.user.termsAcceptedAt && ` · conditions acceptées le ${dateFr(me.user.termsAcceptedAt)}`}.</p>
          </form>
        </section>

        <EmailSection />
        <PasswordSection />
        <SessionsSection />

        <section className="set-row">
          <div className="set-label"><h2>Mode jour / nuit</h2><p>Sur cet appareil. « Système » suit le réglage de ton téléphone ou de ton ordinateur.</p></div>
          <div className="card" style={{ maxWidth: 360 }}><ThemeSwitch /></div>
        </section>

        <section className="set-row">
          <div className="set-label"><h2>Mes données</h2><p>Profil, prêts, remboursements, emprunts, notifications et paiements.</p></div>
          <div className="card stack">
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>Télécharge l&apos;ensemble des données liées à ton compte : profil, prêts, remboursements, emprunts, notifications et paiements (fichier JSON).</p>
            <div><button type="button" className="btn" onClick={exportData} disabled={busy === "export"}>{busy === "export" ? <><Spinner />Préparation…</> : <><Icon name="download" size={16} />Télécharger mes données</>}</button></div>
            <p className="hint">Comment tes données sont utilisées : <Link href="/confidentialite">politique de confidentialité</Link>. Mesure d&apos;audience : <Link href="/cookies">gérer</Link>.</p>
          </div>
        </section>

        <section className="set-row">
          <div className="set-label"><h2>Supprimer mon compte</h2><p>Action définitive et immédiate.</p></div>
          <div className="card stack danger-zone">
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              Suppression définitive et immédiate du compte, de tes prêts, de leur historique et de tes notifications.
              {paid && " Ton abonnement est résilié immédiatement, sans remboursement de la période en cours (sauf rétractation dans les 14 jours)."}
              {" "}Les justificatifs de paiement sont conservés 10 ans sans lien avec ton compte (obligation comptable).
            </p>
            {!confirmDelete ? (
              <div><button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={16} />Supprimer mon compte</button></div>
            ) : (
              <form className="stack grow-in" onSubmit={deleteAccount}>
                <label className="field">Confirme avec ton mot de passe
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" autoFocus />
                </label>
                <div className="row">
                  <button className="btn danger solid" disabled={busy === "delete" || !password}>{busy === "delete" ? <><Spinner />Suppression…</> : "Supprimer définitivement"}</button>
                  <button type="button" className="btn ghost" onClick={() => { setConfirmDelete(false); setPassword(""); }}>Annuler</button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      <div style={{ marginTop: 24 }}><LegalLinks /></div>
    </>
  );
}

function Done({ children }: { children: React.ReactNode }) {
  return <span className="small ok-text row grow-in" style={{ gap: 6 }} role="status"><Icon name="check" size={14} />{children}</span>;
}

/** Changement d'adresse : la nouvelle adresse n'est utilisée qu'une fois confirmée par le lien qu'elle reçoit. */
function EmailSection() {
  const { me, refresh } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!me) return null;
  const { emailVerifiedAt, pendingEmail } = me.user;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api("/api/account/email", { body: { email, password } }); await refresh(); setOpen(false); setEmail(""); setPassword(""); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  async function cancel() {
    setBusy(true); setErr("");
    try { await api("/api/account/email", { method: "DELETE" }); await refresh(); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <section className="set-row">
      <div className="set-label"><h2>Adresse e-mail</h2><p>Elle sert à te connecter et à recevoir les alertes. Tes emprunts y sont rattachés.</p></div>
      <div className="card stack">
        {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <b className="truncate">{me.user.email}</b>
          {emailVerifiedAt ? <span className="tag brand">Confirmée</span> : <span className="tag">À confirmer</span>}
        </div>
        {pendingEmail && (
          <div className="banner soon" role="status" style={{ flexWrap: "wrap" }}>
            <Icon name="mail" size={16} />
            <span style={{ flex: "1 1 220px" }}>Changement en attente : clique sur le lien envoyé à <strong>{pendingEmail}</strong>. D&apos;ici là, ton adresse reste la même.</span>
            <button type="button" className="btn small ghost" onClick={cancel} disabled={busy}>Annuler</button>
          </div>
        )}
        {!open ? (
          <div><button type="button" className="btn" onClick={() => setOpen(true)}><Icon name="pencil" size={15} />Changer d&apos;adresse</button></div>
        ) : (
          <form className="stack grow-in" onSubmit={submit}>
            <label className="field">Nouvelle adresse e-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
            <PasswordField id="email-pw" label="Ton mot de passe actuel" value={password} onChange={setPassword} />
            <p className="hint">Un lien de confirmation sera envoyé à la nouvelle adresse. Ton adresse actuelle sera prévenue du changement.</p>
            <div className="row">
              <button className="btn primary" disabled={busy}>{busy ? <><Spinner />Envoi…</> : "Envoyer le lien"}</button>
              <button type="button" className="btn ghost" onClick={() => { setOpen(false); setPassword(""); setErr(""); }}>Annuler</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setDone(false);
    try { await api("/api/account/password", { body: { current, password } }); setCurrent(""); setPassword(""); setDone(true); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <section className="set-row">
      <div className="set-label"><h2>Mot de passe</h2><p>Tes autres appareils seront déconnectés. Celui-ci reste connecté.</p></div>
      <form className="card stack" onSubmit={submit}>
        {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
        <PasswordField id="pw-current" label="Mot de passe actuel" value={current} onChange={setCurrent} />
        <PasswordField id="pw-new" label="Nouveau mot de passe" value={password} onChange={(v) => { setPassword(v); setDone(false); }} isNew />
        <div className="row">
          <button className="btn" disabled={busy || !current || !password}>{busy ? <><Spinner />Enregistrement…</> : "Changer le mot de passe"}</button>
          {done && <Done>Mot de passe changé</Done>}
        </div>
        <p className="hint">Mot de passe oublié ? <Link href="/mot-de-passe-oublie">Recevoir un lien par e-mail</Link>.</p>
      </form>
    </section>
  );
}

function SessionsSection() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ count: number }>("/api/account/sessions").then((r) => setCount(r.count)).catch(() => {}); }, []);

  async function signOutOthers() {
    setBusy(true); setErr("");
    try { await api("/api/account/sessions", { method: "DELETE" }); setCount(1); setDone(true); }
    catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  const others = count === null ? null : Math.max(0, count - 1);
  return (
    <section className="set-row">
      <div className="set-label"><h2>Appareils connectés</h2><p>Un téléphone perdu, un ordinateur partagé ? Déconnecte-les d&apos;ici.</p></div>
      <div className="card stack">
        {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
        <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
          {others === null ? "…" : others === 0 ? "Aucun autre appareil n'est connecté à ton compte." : `${others} autre${others > 1 ? "s" : ""} appareil${others > 1 ? "s" : ""} connecté${others > 1 ? "s" : ""} à ton compte.`}
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={signOutOthers} disabled={busy || others === 0}>
            {busy ? <><Spinner />Déconnexion…</> : <><Icon name="logout" size={15} />Déconnecter les autres appareils</>}
          </button>
          {done && <Done>C&apos;est fait</Done>}
        </div>
      </div>
    </section>
  );
}
