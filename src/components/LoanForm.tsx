"use client";
import { useState } from "react";
import type { LoanDTO } from "./LoanList";

const toInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const inDays = (n: number) => toInput(new Date(Date.now() + n * 86400000));

export type LoanInput = {
  kind: "OBJECT" | "MONEY"; amount: string; item: string; description: string; borrowerName: string; borrowerEmail: string; borrowerPhone: string;
  lentAt: string; dueAt: string; autoReminder: boolean; remindBefore: boolean; notes: string;
};

export function LoanForm({ initial, submitLabel, onSubmit }: { initial?: LoanDTO; submitLabel: string; onSubmit: (v: LoanInput) => Promise<void> }) {
  const [v, setV] = useState<LoanInput>({
    kind: initial?.kind ?? "OBJECT",
    amount: initial?.amountCents ? String(initial.amountCents / 100).replace(".", ",") : "",
    item: initial?.kind === "MONEY" && initial.item === "Prêt d'argent" ? "" : initial?.item ?? "", description: initial?.description ?? "",
    borrowerName: initial?.borrowerName ?? "", borrowerEmail: initial?.borrowerEmail ?? "", borrowerPhone: initial?.borrowerPhone ?? "",
    lentAt: initial ? toInput(new Date(initial.lentAt)) : inDays(0),
    dueAt: initial ? toInput(new Date(initial.dueAt)) : inDays(14),
    autoReminder: initial?.autoReminder ?? true, remindBefore: initial?.remindBefore ?? true, notes: initial?.notes ?? "",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof LoanInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await onSubmit(v); } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {err && <div className="alert bad">{err}</div>}
      <div className="tabs" role="tablist" aria-label="Type de prêt">
        <button type="button" className={v.kind === "OBJECT" ? "active" : ""} onClick={() => setV({ ...v, kind: "OBJECT" })}>📦 Un objet</button>
        <button type="button" className={v.kind === "MONEY" ? "active" : ""} onClick={() => setV({ ...v, kind: "MONEY" })}>💶 De l&apos;argent</button>
      </div>
      {v.kind === "OBJECT" ? (
        <div className="card stack">
          <h3>L&apos;objet</h3>
          <label className="field">Quoi ?<input value={v.item} onChange={set("item")} placeholder="Perceuse Bosch, Dune tome 1…" required maxLength={120} /></label>
          <label className="field">Détails (optionnel)<textarea value={v.description} onChange={set("description")} rows={2} placeholder="État, accessoires fournis…" /></label>
        </div>
      ) : (
        <div className="card stack">
          <h3>Le montant</h3>
          <label className="field">Combien ? (€)
            <input inputMode="decimal" value={v.amount} onChange={set("amount")} placeholder="50" required pattern="[0-9]+([.,][0-9]{1,2})?" style={{ fontSize: 22, fontWeight: 600 }} />
          </label>
          <label className="field">Pour quoi ? (optionnel)<input value={v.item} onChange={set("item")} placeholder="Resto, billet de train, avance loyer…" maxLength={120} /></label>
          {initial && initial.repaidCents > 0 && <p className="tiny muted" style={{ margin: 0 }}>Déjà remboursé : {(initial.repaidCents / 100).toLocaleString("fr-FR")} €</p>}
        </div>
      )}
      <div className="card stack">
        <h3>À qui ?</h3>
        <label className="field">Nom<input value={v.borrowerName} onChange={set("borrowerName")} required maxLength={80} /></label>
        <label className="field">E-mail<input type="email" value={v.borrowerEmail} onChange={set("borrowerEmail")} required /></label>
        <label className="field">Téléphone (optionnel)<input type="tel" value={v.borrowerPhone} onChange={set("borrowerPhone")} /></label>
        <p className="tiny muted" style={{ margin: 0 }}>La personne reçoit un e-mail. Si elle a un compte, elle est aussi notifiée dans l&apos;appli.</p>
      </div>
      <div className="card stack">
        <h3>Quand ?</h3>
        <div className="grid grid-2">
          <label className="field">Prêté le<input type="date" value={v.lentAt} onChange={set("lentAt")} required /></label>
          <label className="field">À rendre le<input type="date" value={v.dueAt} onChange={set("dueAt")} required min={v.lentAt} /></label>
        </div>
        <div className="row">
          {[7, 14, 30].map((n) => <button type="button" key={n} className="btn small" onClick={() => setV({ ...v, dueAt: toInput(new Date(new Date(v.lentAt).getTime() + n * 86400000)) })}>+{n} jours</button>)}
        </div>
      </div>
      <div className="card stack">
        <h3>Options</h3>
        <label className="check"><input type="checkbox" checked={v.remindBefore} onChange={set("remindBefore")} /><span>Rappel la veille de l&apos;échéance</span></label>
        <label className="check"><input type="checkbox" checked={v.autoReminder} onChange={set("autoReminder")} /><span>Relance automatique tous les 3 jours en cas de retard</span></label>
        <label className="field">Note perso (visible par toi seul)<textarea value={v.notes} onChange={set("notes")} rows={2} /></label>
      </div>
      <button className="btn primary block" disabled={busy}>{busy ? "…" : submitLabel}</button>
    </form>
  );
}

/** Convertit le formulaire en payload API (dates à midi local pour éviter les décalages de fuseau). */
export function toPayload(v: LoanInput) {
  const { amount, ...rest } = v;
  const amountCents = v.kind === "MONEY" ? Math.round(Number(amount.replace(",", ".").replace(/\s/g, "")) * 100) : null;
  if (v.kind === "MONEY" && (!amountCents || amountCents <= 0)) throw new Error("Montant invalide");
  return {
    ...rest,
    amountCents,
    description: v.description || null, borrowerPhone: v.borrowerPhone || null, notes: v.notes || null,
    lentAt: new Date(`${v.lentAt}T12:00:00`).toISOString(),
    dueAt: new Date(`${v.dueAt}T23:59:00`).toISOString(),
  };
}
