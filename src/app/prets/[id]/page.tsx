"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoanForm, toPayload } from "@/components/LoanForm";
import type { LoanDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { api, dateFr, dueLabel, itemEmoji } from "@/lib/client";

export default function LoanPage() {
  return <AppShell><Suspense><LoanDetail /></Suspense></AppShell>;
}

function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get("created");
  const router = useRouter();
  const { refresh } = useMe();
  const [loan, setLoan] = useState<LoanDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<{ tone: string; text: string } | null>(created ? { tone: "good", text: "Prêt enregistré, l'emprunteur a été prévenu par e-mail." } : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/api/loans/${id}`).then((r) => setLoan(r.loan)).catch(() => setNotFound(true)); }, [id]);

  if (notFound) return <div className="card empty">Prêt introuvable. <Link href="/prets">Retour</Link></div>;
  if (!loan) return <div className="empty">Chargement…</div>;

  const due = dueLabel(loan.dueAt, loan.status);

  async function act(fn: () => Promise<void>) {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { setMsg({ tone: "bad", text: (e as Error).message }); }
    setBusy(false);
  }

  const markReturned = () => act(async () => {
    const r = await api(`/api/loans/${loan.id}`, { method: "PATCH", body: { action: "return" } });
    setLoan(r.loan); await refresh();
    setMsg({ tone: "good", text: "Prêt clôturé 🎉" });
  });
  const reopen = () => act(async () => {
    const r = await api(`/api/loans/${loan.id}`, { method: "PATCH", body: { action: "reopen" } });
    setLoan(r.loan); await refresh();
  });
  const remind = () => act(async () => {
    await api(`/api/loans/${loan.id}/remind`, { method: "POST" });
    setMsg({ tone: "good", text: `Relance envoyée à ${loan.borrowerEmail}` });
    setLoan({ ...loan, lastReminderAt: new Date().toISOString(), reminderCount: loan.reminderCount + 1 });
  });
  const remove = () => act(async () => {
    if (!confirm("Supprimer définitivement ce prêt ?")) return;
    await api(`/api/loans/${loan.id}`, { method: "DELETE" });
    await refresh();
    router.replace("/prets");
  });

  if (edit) {
    return (
      <div>
        <button className="btn small" onClick={() => setEdit(false)}>← Annuler</button>
        <h1 style={{ marginTop: 8 }}>Modifier le prêt</h1>
        <LoanForm initial={loan} submitLabel="Enregistrer" onSubmit={async (v) => {
          const r = await api(`/api/loans/${loan.id}`, { method: "PATCH", body: toPayload(v) });
          setLoan(r.loan); setEdit(false); setMsg({ tone: "good", text: "Modifications enregistrées" });
        }} />
      </div>
    );
  }

  return (
    <div className="stack">
      <Link href="/prets" className="small">← Mes prêts</Link>
      {msg && <div className={`alert ${msg.tone}`}>{msg.text}</div>}
      <div className="card stack">
        <div className="loan">
          <div className="loan-ico" style={{ width: 56, height: 56, fontSize: 28 }}>{itemEmoji(loan.item)}</div>
          <div className="loan-main">
            <h1 style={{ margin: 0, fontSize: 22 }}>{loan.item}</h1>
            <span className={`badge ${due.tone}`}>{due.text}</span>
          </div>
        </div>
        {loan.description && <p className="small" style={{ margin: 0 }}>{loan.description}</p>}
        <table className="tbl">
          <tbody>
            <tr><td className="muted">Emprunteur</td><td>{loan.borrowerName} {loan.borrowerId && <span className="badge accent">a un compte</span>}</td></tr>
            <tr><td className="muted">E-mail</td><td><a href={`mailto:${loan.borrowerEmail}`}>{loan.borrowerEmail}</a></td></tr>
            {loan.borrowerPhone && <tr><td className="muted">Téléphone</td><td><a href={`tel:${loan.borrowerPhone}`}>{loan.borrowerPhone}</a></td></tr>}
            <tr><td className="muted">Prêté le</td><td>{dateFr(loan.lentAt)}</td></tr>
            <tr><td className="muted">À rendre le</td><td>{dateFr(loan.dueAt)}</td></tr>
            {loan.returnedAt && <tr><td className="muted">Rendu le</td><td>{dateFr(loan.returnedAt)}</td></tr>}
            <tr><td className="muted">Rappels</td><td>{loan.reminderCount} envoyé{loan.reminderCount > 1 ? "s" : ""}{loan.lastReminderAt && ` · dernier le ${dateFr(loan.lastReminderAt)}`}</td></tr>
            <tr><td className="muted">Options</td><td className="small">{[loan.remindBefore && "rappel la veille", loan.autoReminder && "relance auto si retard"].filter(Boolean).join(", ") || "aucun rappel auto"}</td></tr>
          </tbody>
        </table>
        {loan.notes && <div className="alert info small">📝 {loan.notes}</div>}
      </div>

      {loan.status === "ACTIVE" ? (
        <div className="stack">
          <button className="btn primary block" disabled={busy} onClick={markReturned}>✓ On me l&apos;a rendu — clôturer</button>
          <div className="row">
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={remind}>📧 Relancer maintenant</button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => setEdit(true)}>✏️ Modifier</button>
          </div>
        </div>
      ) : (
        <button className="btn block" disabled={busy} onClick={reopen}>Rouvrir le prêt</button>
      )}
      <button className="btn danger small" disabled={busy} onClick={remove} style={{ alignSelf: "center" }}>Supprimer</button>
    </div>
  );
}
