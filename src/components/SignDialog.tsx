"use client";
import { useEffect, useRef, useState } from "react";
import { api, euros } from "@/lib/client";
import { NAME_PLACEHOLDER, repaymentStatement, returnStatement, type DocLoan } from "@/lib/receipt-text";
import { signatureProblem, type SignatureData } from "@/lib/signature";
import { Icon } from "./Icon";
import type { LoanDTO } from "./LoanList";
import { useMe } from "./Providers";
import { SignaturePad } from "./SignaturePad";
import { Spinner } from "./ui";

/** Ce que le prêteur s'apprête à signer : un remboursement (montant) ou le retour de l'objet. */
export type SignRequest = { kind: "REPAYMENT"; amountCents: number } | { kind: "RETURN" };
export type SignResult = { loan: LoanDTO; receipt: { id: string; number: string } };

/**
 * Le prêteur signe le reçu d'un remboursement ou l'attestation de restitution : aperçu du texte exact (le même
 * code le construit à la signature), nom, signature tracée, case à cocher. Le document part ensuite en PDF à
 * l'emprunteur et au prêteur.
 */
export function SignDialog({ loan, request, onClose, onDone }: { loan: LoanDTO; request: SignRequest | null; onClose: () => void; onDone: (r: SignResult) => void }) {
  const { me } = useMe();
  const [name, setName] = useState("");
  const [sig, setSig] = useState<SignatureData | null>(null);
  const [accept, setAccept] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!request) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    setName(me?.user.name ?? ""); setSig(null); setAccept(false); setNote(""); setErr(""); setBusy(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>("input, textarea")?.focus());
    return () => { document.body.style.overflow = prev; lastFocus.current?.focus?.(); };
  }, [request, me?.user.name]);

  if (!request) return null;
  const money = request.kind === "REPAYMENT";
  const rest = Math.max(0, (loan.amountCents ?? 0) - loan.repaidCents);
  const amount = money ? Math.min(request.amountCents, rest) : 0;
  const doc: DocLoan = { kind: loan.kind, item: loan.item, description: loan.description, amountCents: loan.amountCents, lentAt: loan.lentAt, dueAt: loan.dueAt };
  const lender = { organization: me?.user.organization ?? null };
  const signer = name.trim() || NAME_PLACEHOLDER;
  const statement = money
    ? repaymentStatement(signer, lender, loan.borrowerName, doc, { amountCents: amount, repaidAfterCents: loan.repaidCents + amount })
    : returnStatement(signer, lender, loan.borrowerName, doc, note.trim() || null);
  const close = () => { if (!busy) onClose(); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = !sig ? "Signe dans le cadre avant de valider." : "strokes" in sig ? signatureProblem(sig) : null;
    if (problem) { setErr(problem); return; }
    if (!accept) { setErr("Coche la case pour signer le document."); return; }
    setBusy(true); setErr("");
    try {
      const r = await api<SignResult>(`/api/loans/${loan.id}`, {
        method: "PATCH",
        body: { ...(money ? { action: "repay", amountCents: amount } : { action: "return" }), note: note.trim() || null, signerName: name, signature: sig, accept: true },
      });
      onDone(r);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") {
      const els = [...(box.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, a[href]") ?? [])];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i === els.length - 1 ? 0 : i + 1);
      e.preventDefault();
      els[next].focus();
    }
  }

  const title = money ? (amount >= rest ? "Signer le reçu de solde" : "Signer le reçu de remboursement") : "Signer l'attestation de restitution";
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={box} className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="sign-title" onKeyDown={onKey}>
        <form className="stack" onSubmit={submit}>
          <div className="row" style={{ gap: 12, flexWrap: "nowrap" }}>
            <div className="dialog-ico" style={{ margin: 0 }}><Icon name="signature" size={20} /></div>
            <div style={{ minWidth: 0 }}>
              <h2 id="sign-title">{title}</h2>
              <p className="small muted" style={{ margin: "2px 0 0" }}>
                {money
                  ? <>{euros(amount)} reçus de {loan.borrowerName}{amount < rest ? ` · reste dû ensuite : ${euros(rest - amount)}` : " · le prêt sera soldé"}</>
                  : <>« {loan.item} » rendu par {loan.borrowerName}</>}
              </p>
            </div>
          </div>
          {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
          <label className="field"><span>{money ? "Mode de paiement ou précision" : "Observations sur l'état du bien"} <span className="opt">— facultatif, figure sur le document</span></span>
            {money
              ? <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Espèces, virement, chèque n° …" />
              : <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="Rendu complet et en bon état, rayure sur le capot…" />}
          </label>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Ce que tu signes</div>
            <div className="statement">{statement.map((p) => <p key={p}>{p}</p>)}</div>
          </div>
          <label className="field">Ton nom et prénom (signataire)
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
          </label>
          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Ta signature</div>
            <SignaturePad value={sig} onChange={(s) => { setSig(s); setErr(""); }} name={name} />
          </div>
          <label className="check">
            <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErr(""); }} />
            <span>Je certifie l&apos;exactitude de ce document et je le signe électroniquement. Il sera envoyé en PDF à {loan.borrowerName} et à moi.</span>
          </label>
          <p className="hint"><Icon name="printer" size={13} className="inline-ico" /> Imprime ensuite le PDF et garde-le : Prêt Matériel n&apos;archive pas tes documents.</p>
          <div className="dialog-actions" style={{ marginTop: 4 }}>
            <button type="button" className="btn ghost" onClick={close} disabled={busy}>Annuler</button>
            <button className="btn primary" disabled={busy}>{busy ? <><Spinner />Signature…</> : "Signer et envoyer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
