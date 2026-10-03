"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { LoanForm, toPayload } from "@/components/LoanForm";
import type { LoanDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { useToast } from "@/components/Toast";
import { Avatar, CountUp, DueChip, EmptyState, Menu, Meter, PageHeader, Spinner, Stamp, Switch } from "@/components/ui";
import { api, dateFr, dateShort, dayDiff, dueInfo, euros, isMoney, loanTitle, moneyReason, relTime, remainingCents } from "@/lib/client";

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
  const welcomed = useRef(false);

  useEffect(() => { api(`/api/loans/${id}`).then((r) => setLoan(r.loan)).catch(() => setNotFound(true)); }, [id]);
  useEffect(() => {
    if (!created || welcomed.current) return;
    welcomed.current = true;
    toast.show({ text: "Prêt enregistré. L'emprunteur a été prévenu par e-mail." });
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

  function markReturned() {
    const prev = loan!;
    setLoan({ ...prev, status: "RETURNED", returnedAt: new Date().toISOString(), repaidCents: money ? prev.amountCents! : prev.repaidCents });
    slam();
    toast.defer({
      text: money ? "Prêt soldé" : "Prêt clôturé : l'objet est rendu",
      run: async () => {
        const r = await api(`/api/loans/${prev.id}`, { method: "PATCH", body: { action: "return" } });
        setLoan(r.loan);
        await refresh();
      },
      onUndo: () => { setStamp("out"); setTimeout(() => { setStamp(null); setLoan(prev); }, 280); },
      onError: () => { setStamp(null); setLoan(prev); },
    });
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

  async function addRepayment(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(repay.replace(",", ".").replace(/\s/g, "")) * 100);
    if (!cents || cents <= 0) { toast.show({ tone: "error", text: "Montant invalide" }); return; }
    setBusy(true);
    try {
      const r = await api(`/api/loans/${loan!.id}`, { method: "PATCH", body: { action: "repay", amountCents: cents } });
      setLoan(r.loan);
      setRepay("");
      if (r.loan.status === "RETURNED") {
        slam();
        await refresh();
        toast.show({ text: "Tout est remboursé : prêt soldé" });
      } else {
        toast.show({ text: `Remboursement de ${euros(Math.min(cents, rest))} enregistré` });
      }
    } catch (x) { toast.show({ tone: "error", text: (x as Error).message }); }
    setBusy(false);
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
    const ok = await confirm({
      title: "Supprimer ce prêt ?", icon: "trash", danger: true, confirmLabel: "Supprimer",
      body: <>La fiche « {loanTitle(loan!)} » et son historique seront effacés définitivement. Aucun rappel ne partira plus.</>,
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
    return (
      <>
        <button type="button" className="crumb" onClick={() => setEdit(false)}><Icon name="arrowLeft" size={14} />Retour à la fiche</button>
        <PageHeader title="Modifier le prêt" sub={loanTitle(loan)} />
        <LoanForm initial={loan} submitLabel="Enregistrer les modifications" onCancel={() => setEdit(false)} onSubmit={async (v) => {
          const r = await api(`/api/loans/${loan.id}`, { method: "PATCH", body: toPayload(v) });
          setLoan(r.loan);
          setEdit(false);
          toast.show({ text: "Modifications enregistrées" });
        }} />
      </>
    );
  }

  const stampLabel = !active ? (money ? "Soldé" : "Rendu") : d.tone === "late" ? "En retard" : null;
  const stateText = active ? d.long : `${money ? "Soldé" : "Rendu"} le ${dateFr(loan.returnedAt ?? loan.dueAt)}`;
  let remindNote = "";
  if (active && d.tone !== "late") remindNote = loan.remindBefore ? "Un rappel automatique part la veille de l'échéance. La relance manuelle devient possible après la date de retour." : "La relance manuelle devient possible après la date de retour.";
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
              <div className="fiche-top"><span>Fiche n° {loan.id.slice(-5).toUpperCase()}</span><span className="sep">/</span><span>{money ? "Argent" : "Objet"}</span></div>
              <h1 className="fiche-title">{money ? euros(loan.amountCents!) : loan.item}</h1>
              {money && moneyReason(loan) && <p className="fiche-desc">{moneyReason(loan)}</p>}
              {loan.description && <p className="fiche-desc">{loan.description}</p>}
              <div className="fiche-state"><DueChip loan={loan} /><span>{stateText}</span></div>
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
                    <button type="button" className="btn" disabled={!canRemind} onClick={remind}><Icon name="send" size={15} />Relancer</button>
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
                    <td className="small">{r.note ?? ""}</td>
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
    </>
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
