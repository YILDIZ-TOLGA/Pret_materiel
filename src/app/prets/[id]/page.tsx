"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { LoanForm, toPayload } from "@/components/LoanForm";
import { AckTag, type LoanDTO, type ReceiptDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { SignDialog, type SignRequest, type SignResult } from "@/components/SignDialog";
import { useToast } from "@/components/Toast";
import { Avatar, CountUp, DueChip, EmptyState, Menu, Meter, PageHeader, Spinner, Stamp, Switch } from "@/components/ui";
import { api, dateFr, dateShort, dayDiff, downloadFile, dueInfo, euros, isMoney, loanTitle, moneyReason, relTime, remainingCents } from "@/lib/client";
import { DOC_TITLES } from "@/lib/receipt-text";

const HOUR = 3600000;
/** Montant animé : arrondi à l'euro pendant le défilement, exact à l'arrivée. */
const eurosTo = (target: number) => (n: number) => euros(Math.abs(n - target) < 0.5 ? target : Math.round(n / 100) * 100);

export default function LoanPage() {
  return <Suspense><LoanDetail /></Suspense>;
}

function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get("created");
  const router = useRouter();
  const { refresh } = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const [loan, setLoan] = useState<LoanDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [repay, setRepay] = useState("");
  const [stamp, setStamp] = useState<"in" | "out" | null>(null);
  const [thump, setThump] = useState(false);
  const [signing, setSigning] = useState<SignRequest | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const welcomed = useRef(false);

  useEffect(() => {
    api<{ loan: LoanDTO; borrowerOptedOut: boolean }>(`/api/loans/${id}`)
      .then((r) => { setLoan(r.loan); setOptedOut(r.borrowerOptedOut); })
      .catch(() => setNotFound(true));
  }, [id]);
  useEffect(() => {
    if (!created || welcomed.current) return;
    welcomed.current = true;
    toast.show(created === "nomail"
      ? { tone: "error", text: "Prêt enregistré, mais la demande de signature n'a pas pu être envoyée : renvoie-la depuis la fiche." }
      : { text: "Prêt enregistré. La demande de signature de l'accusé de réception est partie par e-mail." });
    router.replace(`/prets/${id}`, { scroll: false });
  }, [created, id, router, toast]);

  if (notFound) {
    return (
      <div className="card flush">
        <EmptyState title="Fiche introuvable" action={<Link href="/prets" className="btn">Retour aux prêts</Link>}>Ce prêt a peut-être été supprimé.</EmptyState>
      </div>
    );
  }
  if (!loan) return <DetailSkeleton />;

  const money = isMoney(loan);
  const active = loan.status === "ACTIVE";
  const d = dueInfo(loan);
  const rest = remainingCents(loan);
  const recentlyReminded = !!loan.lastReminderAt && Date.now() - new Date(loan.lastReminderAt).getTime() < HOUR;
  const canRemind = active && d.tone === "late" && !recentlyReminded;

  function slam() {
    setStamp("in");
    setThump(true);
    setTimeout(() => setThump(false), 800);
  }

  /** Retour de l'objet ou solde : le prêteur signe l'attestation ou le reçu, envoyé à l'emprunteur. */
  function markReturned() {
    setSigning(money ? { kind: "REPAYMENT", amountCents: rest } : { kind: "RETURN" });
  }

  async function signed(r: SignResult) {
    setSigning(null);
    setLoan(r.loan);
    if (r.loan.status === "RETURNED") slam();
    await refresh();
    toast.show({
      text: `${r.loan.status === "RETURNED" ? (money ? "Prêt soldé" : "Retour attesté") : "Remboursement enregistré"} : document signé envoyé à ${r.loan.borrowerName}`,
      action: { label: "Télécharger", onClick: () => download(r.receipt) },
      duration: 9000,
    });
  }

  async function download(d: { id: string; number: string }) {
    try {
      await downloadFile(`/api/receipts/${d.id}`, `${d.number}.pdf`);
      setLoan((l) => l && { ...l, receipts: l.receipts?.map((x) => (x.id === d.id ? { ...x, downloadedAt: x.downloadedAt ?? new Date().toISOString() } : x)) });
    } catch (x) { toast.show({ tone: "error", text: (x as Error).message }); }
  }

  async function requestSignature() {
    setBusy(true);
    try {
      const r = await api<{ ackRequestedAt: string }>(`/api/loans/${loan!.id}/sign-request`, { method: "POST" });
      setLoan((l) => l && { ...l, ackStatus: "PENDING", ackRequestedAt: r.ackRequestedAt, reminderCount: l.reminderCount + 1 });
      toast.show({ text: `Demande de signature envoyée à ${loan!.borrowerName}` });
    } catch (x) { toast.show({ tone: "error", text: (x as Error).message }); }
    setBusy(false);
  }

  function remind() {
    if (!canRemind) return;
    const target = loan!;
    toast.defer({
      text: `Relance envoyée à ${target.borrowerName}`,
      delay: 4000,
      run: async () => {
        await api(`/api/loans/${target.id}/remind`, { method: "POST" });
        setLoan((l) => l && { ...l, lastReminderAt: new Date().toISOString(), reminderCount: l.reminderCount + 1 });
      },
    });
  }

  /** Remboursement reçu : le prêteur signe le reçu, envoyé à l'emprunteur. */
  function addRepayment(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(repay.replace(",", ".").replace(/\s/g, "")) * 100);
    if (!cents || cents <= 0) { toast.show({ tone: "error", text: "Montant invalide" }); return; }
    setSigning({ kind: "REPAYMENT", amountCents: Math.min(cents, rest) });
  }

  async function toggle(key: "remindBefore" | "autoReminder", value: boolean) {
    const prev = loan!;
    setLoan({ ...prev, ...(key === "remindBefore" ? { remindBefore: value } : { autoReminder: value }) });
    try { await api(`/api/loans/${prev.id}`, { method: "PATCH", body: { [key]: value } }); }
    catch (x) { setLoan(prev); toast.show({ tone: "error", text: (x as Error).message }); }
  }

  async function reopen() {
    setBusy(true);
    try {
      const r = await api(`/api/loans/${loan!.id}`, { method: "PATCH", body: { action: "reopen" } });
      setStamp(null);
      setLoan(r.loan);
      await refresh();
      toast.show({ text: "Prêt rouvert" });
    } catch (x) { toast.show({ tone: "error", text: (x as Error).message }); }
    setBusy(false);
  }

  async function remove() {
    const docs = loan!.receipts?.length ?? 0;
    const ok = await confirm({
      title: "Supprimer ce prêt ?", icon: "trash", danger: true, confirmLabel: "Supprimer",
      body: <>La fiche « {loanTitle(loan!)} » et son historique seront effacés définitivement. Aucun rappel ne partira plus.
        {docs > 0 && <> <strong>{docs > 1 ? `Les ${docs} documents signés seront aussi supprimés` : "Le document signé sera aussi supprimé"} de Prêt Matériel</strong> : vérifie que tu en as une copie imprimée.</>}</>,
    });
    if (!ok) return;
    try {
      await api(`/api/loans/${loan!.id}`, { method: "DELETE" });
      await refresh();
      toast.show({ text: "Prêt supprimé" });
      router.replace("/prets");
    } catch (x) { toast.show({ tone: "error", text: (x as Error).message }); }
  }

  if (edit) {
    const frozen = loan.status === "RETURNED" && !!loan.receipts?.length;
    return (
      <>
        <button type="button" className="crumb" onClick={() => setEdit(false)}><Icon name="arrowLeft" size={14} />Retour à la fiche</button>
        <PageHeader title="Modifier le prêt" sub={loanTitle(loan)} />
        {loan.status === "ACTIVE" && loan.ackStatus !== "NONE" && (
          <div className="banner soon" style={{ marginBottom: 20 }}><Icon name="signature" size={16} />
            <span>Modifier ce qui a été prêté, le montant, les dates ou l&apos;emprunteur envoie à {loan.borrowerName} un nouvel accusé de réception à signer. Les documents déjà signés restent dans l&apos;historique.</span>
          </div>
        )}
        {frozen && (
          <div className="banner late" style={{ marginBottom: 20 }}><Icon name="lock" size={16} />
            <span>Ce prêt est clôturé et ses documents sont signés : seule la note privée peut encore être modifiée.</span>
          </div>
        )}
        <LoanForm initial={loan} submitLabel="Enregistrer les modifications" onCancel={() => setEdit(false)} onSubmit={async (v) => {
          const r = await api<{ loan: LoanDTO; signRequest: "sent" | "not_sent" | null }>(`/api/loans/${loan.id}`, { method: "PATCH", body: toPayload(v) });
          setLoan(r.loan);
          setEdit(false);
          toast.show(r.signRequest === "not_sent"
            ? { tone: "error", text: "Modifications enregistrées, mais la nouvelle demande de signature n'a pas pu être envoyée." }
            : { text: r.signRequest === "sent" ? `Modifications enregistrées : nouvel accusé de réception envoyé à ${r.loan.borrowerName}` : "Modifications enregistrées" });
        }} />
      </>
    );
  }

  const stampLabel = !active ? (money ? "Soldé" : "Rendu") : d.tone === "late" ? "En retard" : null;
  const stateText = active ? d.long : `${money ? "Soldé" : "Rendu"} le ${dateFr(loan.returnedAt ?? loan.dueAt)}`;
  let remindNote = "";
  if (active && loan.ackStatus === "REFUSED") remindNote = "Prêt contesté : plus aucun rappel n'est envoyé à l'emprunteur.";
  else if (active && d.tone !== "late") remindNote = loan.remindBefore ? "Un rappel automatique part la veille de l'échéance. La relance manuelle devient possible après la date de retour." : "La relance manuelle devient possible après la date de retour.";
  else if (active && recentlyReminded) remindNote = `Relance envoyée ${relTime(loan.lastReminderAt!)}. Prochaine relance possible dans ${Math.max(1, Math.ceil((HOUR - (Date.now() - new Date(loan.lastReminderAt!).getTime())) / 60000))} min.`;
  else if (active && loan.autoReminder) remindNote = "Une relance automatique part aussi tous les 3 jours.";
  const repayments = loan.repayments ?? [];
  const half = Math.round(rest / 200) * 100;

  return (
    <>
      <Link href="/prets" className="crumb"><Icon name="arrowLeft" size={14} />Prêts</Link>
      <div className="detail">
        <div className="d-fiche">
          <article className={`fiche ${thump ? "thump" : ""}`} aria-label={`Fiche du prêt ${loanTitle(loan)}`}>
            <div className={`fiche-part fiche-head ${stampLabel ? "has-stamp" : ""}`}>
              <div className="fiche-top"><span>Fiche n° {loan.id.slice(-5).toUpperCase()}</span><span className="sep">/</span><span>{money ? "Argent" : "Matériel"}</span></div>
              <h1 className="fiche-title">{money ? euros(loan.amountCents!) : loan.item}</h1>
              {money && moneyReason(loan) && <p className="fiche-desc">{moneyReason(loan)}</p>}
              {loan.description && <p className="fiche-desc">{loan.description}</p>}
              <div className="fiche-state"><DueChip loan={loan} /><AckTag loan={loan} />{loan.ackStatus === "SIGNED" && <span className="tag brand" title="Accusé de réception signé par l'emprunteur">Accusé signé</span>}<span>{stateText}</span></div>
              {stampLabel && (
                <div className="fiche-stamp" key={stampLabel}>
                  <Stamp tone={active ? "late" : undefined} state={!active ? stamp ?? undefined : undefined} size="lg">{stampLabel}</Stamp>
                </div>
              )}
            </div>
            <div className="fiche-part fiche-body">
              <dl className="fiche-grid">
                <div><dt>Emprunteur</dt><dd><Avatar name={loan.borrowerName} size="sm" />{loan.borrowerName}{loan.borrowerId && <span className="tag brand" title="L'emprunteur a un compte Prêt Matériel">Membre</span>}</dd></div>
                <div>
                  <dt>Contact</dt>
                  <dd style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                    <a href={`mailto:${loan.borrowerEmail}`}>{loan.borrowerEmail}</a>
                    {loan.borrowerPhone && <a href={`tel:${loan.borrowerPhone}`}>{loan.borrowerPhone}</a>}
                  </dd>
                </div>
                <div><dt>Prêté le</dt><dd className="mono">{dateFr(loan.lentAt)}</dd></div>
                <div><dt>{money ? "À rembourser le" : "À rendre le"}</dt><dd className="mono">{dateFr(loan.dueAt)}</dd></div>
              </dl>
              <Period loan={loan} />
              {money && (
                <div className="repay">
                  <div className="repay-top">
                    <div>
                      <div className="section-label">{active ? "Reste dû" : "Remboursé"}</div>
                      <div className="repay-v"><CountUp value={active ? rest : loan.amountCents!} format={eurosTo(active ? rest : loan.amountCents!)} /></div>
                    </div>
                    <div className="repay-of"><b>{euros(loan.repaidCents)}</b> remboursés<br />sur {euros(loan.amountCents!)}</div>
                  </div>
                  <Meter value={loan.repaidCents / loan.amountCents!} />
                </div>
              )}
            </div>
          </article>
        </div>

        <aside className="d-side">
          <section className="side-card" aria-label="Actions">
            <div className="section-label">Actions</div>
            <div className="side-actions">
              {active ? (
                <>
                  <button type="button" className="btn primary lg block" onClick={markReturned}>
                    <Icon name="check" size={17} />{money ? `Solder le prêt · ${euros(rest)}` : "Marquer comme rendu"}
                  </button>
                  <div className="row">
                    <button type="button" className="btn" disabled={!canRemind || loan.ackStatus === "REFUSED"} onClick={remind}><Icon name="send" size={15} />Relancer</button>
                    <button type="button" className="btn" onClick={() => setEdit(true)}><Icon name="pencil" size={15} />Modifier</button>
                    <Menu label="Plus d'actions" buttonClass="btn icon" button={<Icon name="more" size={18} />}>
                      {(close) => <button type="button" role="menuitem" className="menu-item danger" onClick={() => { close(); remove(); }}><Icon name="trash" size={16} />Supprimer le prêt</button>}
                    </Menu>
                  </div>
                  {remindNote && <p className="side-note">{remindNote}</p>}
                </>
              ) : (
                <>
                  <button type="button" className="btn block" disabled={busy} onClick={reopen}><Icon name="undo" size={16} />Rouvrir le prêt</button>
                  <div className="row">
                    <button type="button" className="btn" onClick={() => setEdit(true)}><Icon name="pencil" size={15} />Modifier</button>
                    <button type="button" className="btn danger" onClick={remove}><Icon name="trash" size={15} />Supprimer</button>
                  </div>
                </>
              )}
            </div>
          </section>

          <AckCard loan={loan} optedOut={optedOut} busy={busy} onRequest={requestSignature} onDownload={download} />

          {active && (
            <section className="side-card" aria-label="Rappels automatiques">
              <div className="section-label">Rappels automatiques</div>
              <label className="switch-row">
                <span><b>La veille de l&apos;échéance</b><small>Un e-mail de rappel à l&apos;emprunteur.</small></span>
                <Switch checked={loan.remindBefore} onChange={(v) => toggle("remindBefore", v)} label="Rappel la veille de l'échéance" />
              </label>
              <label className="switch-row">
                <span><b>En cas de retard</b><small>Une relance tous les 3 jours.</small></span>
                <Switch checked={loan.autoReminder} onChange={(v) => toggle("autoReminder", v)} label="Relance automatique en cas de retard" />
              </label>
            </section>
          )}

          <section className="side-card" aria-label="Historique">
            <div className="section-label">Historique</div>
            <Timeline loan={loan} />
          </section>
        </aside>

        <div className="d-rest">
          <Documents loan={loan} onDownload={download} />
          {money && active && (
            <form className="card" onSubmit={addRepayment}>
              <div className="section-label" style={{ marginBottom: 14 }}>Enregistrer un remboursement</div>
              <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <div className="affix" style={{ flex: 1 }}>
                  <input inputMode="decimal" placeholder="Montant reçu" value={repay} onChange={(e) => setRepay(e.target.value)} pattern="[0-9]+([.,][0-9]{1,2})?" required aria-label="Montant remboursé, en euros" />
                  <span className="affix-r">€</span>
                </div>
                <button className="btn dark" disabled={busy}>{busy ? <Spinner /> : "Enregistrer"}</button>
              </div>
              <div className="chips" style={{ marginTop: 12 }}>
                {half > 0 && half < rest && <button type="button" className="chip" onClick={() => setRepay(String(half / 100).replace(".", ","))}>La moitié · {euros(half)}</button>}
                <button type="button" className="chip" onClick={() => setRepay(String(rest / 100).replace(".", ","))}>Tout le reste · {euros(rest)}</button>
              </div>
            </form>
          )}
          {money && repayments.length > 0 && (
            <section className="card flush">
              <div className="card-head"><h2>Remboursements</h2><span className="mono tiny muted">{repayments.length}</span></div>
              <table className="tbl"><tbody>
                {repayments.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ paddingLeft: 20, whiteSpace: "nowrap" }}>{dateFr(r.createdAt)}</td>
                    <td className="small">{[r.note, r.receipt ? `reçu n° ${r.receipt.number}` : "sans reçu signé"].filter(Boolean).join(" · ")}</td>
                    <td className="num ok-text" style={{ paddingRight: 20 }}>+{euros(r.amountCents)}</td>
                  </tr>
                ))}
              </tbody></table>
            </section>
          )}
          {loan.notes && (
            <div className="notes">
              <div className="section-label"><Icon name="lock" size={12} />Note privée</div>
              {loan.notes}
            </div>
          )}
        </div>
      </div>
      <SignDialog loan={loan} request={signing} onClose={() => setSigning(null)} onDone={signed} />
    </>
  );
}

const fmtDateTime = (d: string) => `${dateFr(d)} à ${new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

/** Accusé de réception : état de la signature par l'emprunteur, relance ou demande, téléchargement. */
function AckCard({ loan, optedOut, busy, onRequest, onDownload }: {
  loan: LoanDTO; optedOut: boolean; busy: boolean; onRequest: () => void; onDownload: (d: ReceiptDTO) => void;
}) {
  const active = loan.status === "ACTIVE";
  const ack = loan.receipts?.find((r) => r.kind === "LOAN");
  const recent = !!loan.ackRequestedAt && Date.now() - new Date(loan.ackRequestedAt).getTime() < 86400000;
  let ico: "check" | "hourglass" | "alert" | "file" = "file", tone = "", t = "", d: React.ReactNode = null, action: React.ReactNode = null;
  if (loan.ackStatus === "SIGNED") {
    ico = "check"; tone = "ok"; t = "Accusé de réception signé";
    d = <>par {ack?.signerName ?? loan.borrowerName}, le {fmtDateTime(loan.ackAt ?? ack?.signedAt ?? loan.lentAt)}</>;
    if (ack) action = <button type="button" className="btn block" onClick={() => onDownload(ack)}><Icon name="download" size={15} />Télécharger l&apos;accusé (PDF)</button>;
  } else if (loan.ackStatus === "PENDING") {
    ico = "hourglass"; tone = "soon"; t = active ? "En attente de la signature" : "Jamais signé";
    d = <>{loan.ackRequestedAt ? <>Demande envoyée à {loan.borrowerEmail} le {fmtDateTime(loan.ackRequestedAt)}.</> : null}{ack && <> Une version précédente a été signée (n° {ack.number}).</>}</>;
    if (active) action = <button type="button" className="btn block" disabled={busy || recent || optedOut} onClick={onRequest}><Icon name="send" size={15} />Renvoyer la demande</button>;
  } else if (loan.ackStatus === "REFUSED") {
    ico = "alert"; tone = "late"; t = "Prêt contesté par l'emprunteur";
    d = <>le {fmtDateTime(loan.ackAt ?? loan.lentAt)}{loan.ackRefusalReason ? <> : « {loan.ackRefusalReason} ».</> : "."} Plus aucun rappel ne lui est envoyé. Corrige le prêt (une nouvelle demande partira) ou supprime-le.</>;
  } else {
    t = "Pas d'accusé de réception";
    d = "Prêt enregistré avant les accusés de réception signés.";
    if (active) action = <button type="button" className="btn block" disabled={busy || optedOut} onClick={onRequest}><Icon name="signature" size={15} />Demander la signature</button>;
  }
  return (
    <section className="side-card" aria-label="Accusé de réception">
      <div className="section-label">Accusé de réception</div>
      <div className="stack" style={{ gap: 12 }}>
        <div className="ack">
          <span className={`ack-ico ${tone}`}><Icon name={ico} size={17} /></span>
          <div style={{ minWidth: 0 }}><div className="ack-t">{t}</div><div className="ack-d">{d}</div></div>
        </div>
        {action}
        {optedOut && <p className="side-note">{loan.borrowerName} a bloqué les e-mails de Prêt Matériel : ni demande de signature, ni reçu, ni rappel ne lui parviennent.</p>}
        {!optedOut && loan.ackStatus === "PENDING" && active && recent && <p className="side-note">Nouvel envoi possible 24 h après la dernière demande.</p>}
      </div>
    </section>
  );
}

/** Documents signés du prêt, à télécharger et à imprimer : Prêt Matériel ne les archive pas. */
function Documents({ loan, onDownload }: { loan: LoanDTO; onDownload: (d: ReceiptDTO) => void }) {
  const docs = loan.receipts ?? [];
  if (!docs.length) return null;
  const toPrint = docs.filter((d) => !d.downloadedAt).length;
  return (
    <section className="card flush" aria-labelledby="docs-title">
      <div className="card-head"><h2 id="docs-title">Documents signés</h2><span className="mono tiny muted">{docs.length}</span></div>
      <div className="card-body" style={{ paddingBottom: 4 }}>
        <div className={`banner ${toPrint ? "soon" : ""}`} style={{ animation: "none" }}>
          <Icon name="printer" size={16} />
          <span>{toPrint ? <><strong>{toPrint > 1 ? `${toPrint} documents à imprimer` : "1 document à imprimer"}.</strong> </> : null}Garde une copie papier de chaque document : c&apos;est ta preuve. Prêt Matériel n&apos;est pas un service d&apos;archivage, et une copie t&apos;a aussi été envoyée par e-mail (<a href="/cgu#documents" target="_blank">CGU, art. 3 bis</a>).</span>
        </div>
      </div>
      <ul className="docs">
        {docs.map((d) => (
          <li key={d.id} className="doc">
            <span className="doc-ico"><Icon name="file" size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="doc-title">{DOC_TITLES[d.kind]}{!d.downloadedAt && <span className="tag soon">À imprimer</span>}</div>
              <div className="doc-meta">n° {d.number} · signé par {d.signerName} le {fmtDateTime(d.signedAt)}</div>
            </div>
            <button type="button" className="btn small" onClick={() => onDownload(d)} aria-label={`Télécharger ${DOC_TITLES[d.kind]} n° ${d.number}`}><Icon name="download" size={14} />PDF</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Period({ loan }: { loan: LoanDTO }) {
  const start = new Date(loan.lentAt).getTime();
  const end = new Date(loan.dueAt).getTime();
  const done = loan.status === "RETURNED";
  const at = done && loan.returnedAt ? new Date(loan.returnedAt).getTime() : Date.now();
  const p = Math.min(1, Math.max(0, (at - start) / Math.max(1, end - start)));
  const late = at > end;
  const total = Math.max(1, dayDiff(new Date(start), new Date(end)));
  const d = dueInfo(loan);
  const tone = late ? "late" : !done && d.tone === "soon" ? "soon" : "";
  const elapsed = Math.max(0, dayDiff(new Date(start), new Date(Math.min(at, end))));
  return (
    <div className={`period ${tone}`}>
      <div className="period-head">
        <span>Durée du prêt</span>
        <span>{done ? `${Math.max(0, dayDiff(new Date(start), new Date(at)))} j au total` : late ? `${-d.days} j de retard` : `jour ${elapsed} sur ${total}`}</span>
      </div>
      <div className="period-track">
        <i style={{ "--p": late ? 1 : p } as React.CSSProperties} />
        {!done && !late && <span className="period-now" style={{ left: `${p * 100}%` }} />}
      </div>
      <div className="period-labels">
        <span>{dateShort(start)}</span>
        {done ? <span>{loan.kind === "MONEY" ? "soldé" : "rendu"} le {dateShort(at)}</span> : late ? <span className="late">aujourd&apos;hui</span> : null}
        <span>{dateShort(end)}</span>
      </div>
    </div>
  );
}

function Timeline({ loan }: { loan: LoanDTO }) {
  const money = isMoney(loan);
  const now = Date.now();
  const active = loan.status === "ACTIVE";
  const due = new Date(loan.dueAt).getTime();
  type Ev = { t: string; d?: string; at: number; kind: "done" | "late" | "soon" | "pending"; future?: boolean };
  const ev: Ev[] = [{ t: "Prêt enregistré", d: dateFr(loan.lentAt), at: new Date(loan.lentAt).getTime(), kind: "done" }];
  for (const r of loan.receipts ?? []) {
    if (r.kind === "LOAN") ev.push({ t: "Accusé de réception signé", d: `n° ${r.number} · ${dateFr(r.signedAt)}`, at: new Date(r.signedAt).getTime(), kind: "done" });
  }
  if (loan.ackStatus === "REFUSED" && loan.ackAt) ev.push({ t: "Prêt contesté par l'emprunteur", d: dateFr(loan.ackAt), at: new Date(loan.ackAt).getTime(), kind: "late" });
  if (loan.ackStatus === "PENDING" && active) ev.push({ t: "Accusé de réception à signer", d: loan.ackRequestedAt ? `demandé le ${dateFr(loan.ackRequestedAt)}` : undefined, at: Date.now() - 1, kind: "soon" });
  for (const r of loan.repayments ?? []) {
    ev.push({ t: `Remboursement de ${euros(r.amountCents)}${r.note ? ` · ${r.note}` : ""}`, d: dateFr(r.createdAt), at: new Date(r.createdAt).getTime(), kind: "done" });
  }
  if (loan.lastReminderAt) {
    ev.push({ t: loan.reminderCount > 1 ? `${loan.reminderCount} rappels envoyés` : "Rappel envoyé", d: `dernier le ${dateFr(loan.lastReminderAt)}`, at: new Date(loan.lastReminderAt).getTime(), kind: "done" });
  }
  ev.push({ t: money ? "Échéance de remboursement" : "Date de retour prévue", d: dateFr(loan.dueAt), at: due, kind: active && due < now ? "late" : due < now ? "done" : "pending", future: due > now });
  ev.sort((a, b) => a.at - b.at);
  // L'issue du prêt ferme toujours la frise (le solde à la clôture est enregistré dans la même seconde).
  if (!active && loan.returnedAt) ev.push({ t: money ? "Prêt soldé" : "Objet rendu", d: dateFr(loan.returnedAt), at: new Date(loan.returnedAt).getTime(), kind: "done" });
  else ev.push({ t: money ? "En attente du remboursement" : "En attente du retour", at: Infinity, kind: "pending", future: true });
  return (
    <ul className="tl">
      {ev.map((e, i) => (
        <li key={i} className={e.future ? "future" : ""}>
          <span className={`tl-dot ${e.kind}`}>{e.kind === "done" && <Icon name="check" size={9} stroke={3.4} />}</span>
          <div className="tl-t">{e.t}</div>
          {e.d && <div className="tl-d">{e.d}</div>}
        </li>
      ))}
    </ul>
  );
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="skel" style={{ width: 70, height: 12, marginBottom: 22 }} />
      <div className="detail">
        <div className="d-fiche"><div className="card" style={{ height: 420 }}><div className="skel" style={{ width: 160, height: 10 }} /><div className="skel" style={{ width: "60%", height: 40, marginTop: 24 }} /><div className="skel" style={{ width: 120, height: 22, marginTop: 22 }} /></div></div>
        <div className="d-side"><div className="card" style={{ height: 150 }} /><div className="card" style={{ height: 200 }} /></div>
      </div>
    </div>
  );
}
