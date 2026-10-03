"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { LegalLinks } from "@/components/SiteFooter";
import { Avatar, PageHeader, Spinner, ThemeSwitch } from "@/components/ui";
import { API_BASE, api, dateFr } from "@/lib/client";
import { LEGAL } from "@/lib/legal";

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
            <label className="field">Adresse e-mail<input value={me.user.email} disabled /></label>
            <p className="hint">Pour changer d&apos;adresse e-mail, écris à {LEGAL.editor.email} depuis ton adresse actuelle.</p>
            <div className="row">
              <button className="btn" disabled={busy === "name" || name.trim() === me.user.name}>{busy === "name" ? <><Spinner />Enregistrement…</> : "Enregistrer"}</button>
              {saved && <span className="small ok-text row grow-in" style={{ gap: 6 }}><Icon name="check" size={14} />Enregistré</span>}
            </div>
            <p className="hint">Compte créé le {dateFr(me.user.createdAt)}{me.user.termsAcceptedAt && ` · conditions acceptées le ${dateFr(me.user.termsAcceptedAt)}`}.</p>
          </form>
        </section>

        <section className="set-row">
          <div className="set-label"><h2>Apparence</h2><p>Thème de l&apos;interface sur cet appareil.</p></div>
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
