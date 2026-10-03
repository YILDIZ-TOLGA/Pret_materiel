"use client";
import { useEffect, useState } from "react";
import { api, dateLong, dateShort, DAY, dayDiff, dueInfo, euros, norm } from "@/lib/client";
import { Icon, type IconName } from "./Icon";
import type { LoanDTO } from "./LoanList";
import { useMe } from "./Providers";
import { Avatar, Spinner, Switch } from "./ui";

const toInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const inDays = (n: number) => toInput(new Date(Date.now() + n * DAY));
const parseCents = (s: string) => Math.round(Number(s.replace(",", ".").replace(/\s/g, "")) * 100) || 0;
const longDate = (s: string) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "…");
const DURATIONS: [number, string][] = [[7, "1 semaine"], [14, "2 semaines"], [30, "1 mois"], [90, "3 mois"]];

export type LoanInput = {
  kind: "OBJECT" | "MONEY"; amount: string; item: string; description: string; borrowerName: string; borrowerEmail: string; borrowerPhone: string;
  lentAt: string; dueAt: string; autoReminder: boolean; remindBefore: boolean; notes: string;
};

type Person = { name: string; email: string; phone: string | null; count: number };

/** Emprunteurs déjà enregistrés, pour compléter nom, e-mail et téléphone en un clic. */
function useKnownBorrowers() {
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    api<{ loans: LoanDTO[] }>("/api/loans").then((r) => {
      const m = new Map<string, Person>();
      for (const l of r.loans) {
        const p = m.get(l.borrowerEmail);
        if (p) { p.count++; p.phone ??= l.borrowerPhone; } else m.set(l.borrowerEmail, { name: l.borrowerName, email: l.borrowerEmail, phone: l.borrowerPhone, count: 1 });
      }
      setPeople([...m.values()].sort((a, b) => b.count - a.count));
    }).catch(() => {});
  }, []);
  return people;
}

export function LoanForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: LoanDTO; submitLabel: string; onSubmit: (v: LoanInput) => Promise<void>; onCancel?: () => void }) {
  const { me } = useMe();
  const people = useKnownBorrowers();
  const [v, setV] = useState<LoanInput>({
    kind: initial?.kind ?? "OBJECT",
    amount: initial?.amountCents ? String(initial.amountCents / 100).replace(".", ",") : "",
    item: initial?.kind === "MONEY" && initial.item === "Prêt d'argent" ? "" : initial?.item ?? "", description: initial?.description ?? "",
    borrowerName: initial?.borrowerName ?? "", borrowerEmail: initial?.borrowerEmail ?? "", borrowerPhone: initial?.borrowerPhone ?? "",
    lentAt: initial ? toInput(new Date(initial.lentAt)) : inDays(0),
    dueAt: initial ? toInput(new Date(initial.dueAt)) : inDays(14),
    autoReminder: initial?.autoReminder ?? true, remindBefore: initial?.remindBefore ?? true, notes: initial?.notes ?? "",
  });
  const [details, setDetails] = useState(!!initial?.description);
  const [notes, setNotes] = useState(!!initial?.notes);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof LoanInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const money = v.kind === "MONEY";
  const span = v.lentAt && v.dueAt ? dayDiff(new Date(`${v.lentAt}T12:00:00`), new Date(`${v.dueAt}T12:00:00`)) : 0;
  const setSpan = (n: number) => setV({ ...v, dueAt: toInput(new Date(new Date(`${v.lentAt || inDays(0)}T12:00:00`).getTime() + n * DAY)) });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await onSubmit(v); }
    catch (x) { setErr((x as Error).message); setBusy(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  const kinds: [LoanInput["kind"], IconName, string, string][] = [
    ["OBJECT", "box", "Un objet", "Outil, livre, jeu, matériel…"],
    ["MONEY", "banknote", "De l'argent", "Avance, resto, billet de train…"],
  ];

  return (
    <form className="lform" onSubmit={submit}>
      <div className="lform-card">
        {err && <div className="banner late" style={{ marginBottom: 22 }}><Icon name="alert" size={16} />{err}</div>}

        <section className="fsec" aria-labelledby="f-what">
          <h2 className="fsec-title" id="f-what"><span className="n">01</span>Ce que tu prêtes</h2>
          <div className="kind" role="radiogroup" aria-labelledby="f-what">
            {kinds.map(([k, icon, title, hint]) => (
              <button key={k} type="button" role="radio" aria-checked={v.kind === k} className="kind-opt" onClick={() => setV({ ...v, kind: k })}>
                <span className="kind-radio" aria-hidden="true" />
                <span className="kind-ico"><Icon name={icon} size={18} /></span>
                <strong>{title}</strong>
                <span>{hint}</span>
              </button>
            ))}
          </div>
          {money ? (
            <div className="stack grow-in" key="money" style={{ gap: 14 }}>
              <label className="field">Montant
                <span className="affix">
                  <input className="big" inputMode="decimal" value={v.amount} onChange={set("amount")} placeholder="50" required pattern="[0-9]+([.,][0-9]{1,2})?" autoFocus={!initial} />
                  <span className="affix-r">€</span>
                </span>
              </label>
              <label className="field"><span>Motif <span className="opt">— optionnel</span></span>
                <input value={v.item} onChange={set("item")} placeholder="Resto, billet de train, avance loyer…" maxLength={120} />
              </label>
              {initial && initial.repaidCents > 0 && <p className="hint">Déjà remboursé : {euros(initial.repaidCents)}.</p>}
            </div>
          ) : (
            <div className="stack grow-in" key="object" style={{ gap: 14 }}>
              <label className="field">Désignation
                <input value={v.item} onChange={set("item")} placeholder="Perceuse Bosch, Dune tome 1…" required maxLength={120} autoFocus={!initial} />
              </label>
              {details ? (
                <label className="field grow-in"><span>Détails <span className="opt">— état, accessoires fournis…</span></span>
                  <textarea value={v.description} onChange={set("description")} rows={2} maxLength={1000} autoFocus />
                </label>
              ) : (
                <button type="button" className="reveal-more" onClick={() => setDetails(true)}><Icon name="plus" size={14} />Ajouter des détails</button>
              )}
            </div>
          )}
        </section>

        <section className="fsec" aria-labelledby="f-who">
          <h2 className="fsec-title" id="f-who"><span className="n">02</span>À qui</h2>
          <BorrowerName value={v.borrowerName} people={people}
            onChange={(name) => setV({ ...v, borrowerName: name })}
            onPick={(p) => setV({ ...v, borrowerName: p.name, borrowerEmail: p.email, borrowerPhone: p.phone ?? "" })} />
          <div className="grid grid-2">
            <label className="field">Adresse e-mail<input type="email" value={v.borrowerEmail} onChange={set("borrowerEmail")} required autoComplete="off" /></label>
            <label className="field"><span>Téléphone <span className="opt">— optionnel</span></span><input type="tel" value={v.borrowerPhone} onChange={set("borrowerPhone")} autoComplete="off" /></label>
          </div>
          <p className="hint">La personne reçoit un e-mail de confirmation (elle peut s&apos;en désinscrire). Préviens-la que tu utilises Prêt Matériel, et n&apos;enregistre que des personnes qui s&apos;attendent à être contactées (<a href="/cgu#utilisation" target="_blank">CGU, art. 3</a>).</p>
        </section>

        <section className="fsec" aria-labelledby="f-when">
          <h2 className="fsec-title" id="f-when"><span className="n">03</span>Jusqu&apos;à quand</h2>
          <div className="grid grid-2">
            <label className="field">Prêté le<input type="date" value={v.lentAt} onChange={set("lentAt")} required /></label>
            <label className="field">{money ? "À rembourser le" : "À rendre le"}<input type="date" value={v.dueAt} onChange={set("dueAt")} required min={v.lentAt} /></label>
          </div>
          <div className="chips" role="group" aria-label="Durée du prêt">
            {DURATIONS.map(([n, label]) => <button type="button" key={n} className="chip" aria-pressed={span === n} onClick={() => setSpan(n)}>{label}</button>)}
          </div>
          {span > 0 && <p className="hint">Soit {span} jour{span > 1 ? "s" : ""} : retour prévu le {dateLong(`${v.dueAt}T12:00:00`)}.</p>}
        </section>

        <section className="fsec" aria-labelledby="f-rem">
          <h2 className="fsec-title" id="f-rem"><span className="n">04</span>Rappels</h2>
          <label className="switch-row">
            <span><b>La veille de l&apos;échéance</b><small>Un e-mail de rappel est envoyé à l&apos;emprunteur.</small></span>
            <Switch checked={v.remindBefore} onChange={(x) => setV({ ...v, remindBefore: x })} label="Rappel la veille de l'échéance" />
          </label>
          <label className="switch-row">
            <span><b>Relance en cas de retard</b><small>Tous les 3 jours, jusqu&apos;au retour.</small></span>
            <Switch checked={v.autoReminder} onChange={(x) => setV({ ...v, autoReminder: x })} label="Relance automatique tous les 3 jours en cas de retard" />
          </label>
          {notes ? (
            <label className="field grow-in"><span>Note privée <span className="opt">— visible par toi uniquement</span></span>
              <textarea value={v.notes} onChange={set("notes")} rows={2} maxLength={1000} autoFocus={!initial?.notes} />
            </label>
          ) : (
            <button type="button" className="reveal-more" onClick={() => setNotes(true)}><Icon name="lock" size={14} />Ajouter une note privée</button>
          )}
        </section>

        <div className="lform-submit">
          <button className="btn primary lg" disabled={busy}>{busy ? <><Spinner />Enregistrement…</> : submitLabel}</button>
          {onCancel && <button type="button" className="btn ghost lg" onClick={onCancel}>Annuler</button>}
        </div>
      </div>

      <aside className="lform-aside" aria-label="Aperçu">
        <div className="section-label">Aperçu de la fiche</div>
        <PreviewFiche v={v} />
        {!initial && (
          <>
            <div className="section-label" style={{ marginTop: 10 }}>E-mail envoyé à l&apos;emprunteur</div>
            <MailPreview v={v} lender={me?.user.name ?? "Toi"} />
          </>
        )}
      </aside>
    </form>
  );
}

function BorrowerName({ value, people, onChange, onPick }: { value: string; people: Person[]; onChange: (v: string) => void; onPick: (p: Person) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const nq = norm(value.trim());
  // Nom (début d'un mot d'abord) ou début de l'adresse : le domaine ne compte pas, il est commun à beaucoup de monde.
  const score = (p: Person) => {
    const n = norm(p.name);
    if (n.startsWith(nq) || n.split(/\s+/).some((w) => w.startsWith(nq))) return 2;
    if (n.includes(nq) || norm(p.email.split("@")[0]).startsWith(nq)) return 1;
    return 0;
  };
  const matches = (nq ? people.map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p) : people)
    .filter((p) => norm(p.name) !== nq)
    .slice(0, 5);
  const show = open && matches.length > 0;

  function pick(p: Person) { onPick(p); setOpen(false); }
  function onKey(e: React.KeyboardEvent) {
    if (!show) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % matches.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s + matches.length - 1) % matches.length); }
    else if (e.key === "Enter") { e.preventDefault(); pick(matches[sel]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="combo">
      <label className="field">Nom
        <input value={value} required maxLength={80} autoComplete="off" role="combobox" aria-expanded={show} aria-controls="borrower-list" aria-autocomplete="list"
          aria-activedescendant={show ? `bo-${sel}` : undefined}
          onChange={(e) => { onChange(e.target.value); setOpen(true); setSel(0); }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey} />
      </label>
      {show && (
        <ul className="combo-list" id="borrower-list" role="listbox">
          <li className="combo-head" role="presentation">Déjà dans ton carnet</li>
          {matches.map((p, i) => (
            <li key={p.email} id={`bo-${i}`} role="option" aria-selected={i === sel} className="combo-opt"
              onMouseDown={(e) => { e.preventDefault(); pick(p); }} onMouseMove={() => setSel(i)}>
              <Avatar name={p.name} size="sm" />{p.name}<span className="e">{p.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewFiche({ v }: { v: LoanInput }) {
  const money = v.kind === "MONEY";
  const cents = parseCents(v.amount);
  const empty = money ? !cents : !v.item.trim();
  const title = money ? euros(cents) : v.item.trim() || "Ton objet";
  const d = v.dueAt ? dueInfo({ dueAt: new Date(`${v.dueAt}T23:59:00`).toISOString(), status: "ACTIVE", kind: v.kind }) : null;
  return (
    <div className="fiche mini">
      <div className="fiche-part fiche-head">
        <div className="fiche-top"><span>Nouvelle fiche</span><span>{money ? "Argent" : "Objet"}</span></div>
        <div className={`fiche-title ${empty ? "placeholder" : ""}`}>{title}</div>
        {money && v.item.trim() && <p className="fiche-desc">{v.item}</p>}
        {d && <div className="fiche-state"><span className={`due ${d.tone}`}>{d.short}</span><span>{d.long}</span></div>}
      </div>
      <div className="fiche-part fiche-body">
        <dl className="fiche-grid">
          <div><dt>Emprunteur</dt><dd>{v.borrowerName.trim() ? <><Avatar name={v.borrowerName} size="xs" /><span className="truncate">{v.borrowerName}</span></> : <span className="placeholder">—</span>}</dd></div>
          <div><dt>Retour</dt><dd className="mono">{v.dueAt ? dateShort(`${v.dueAt}T12:00:00`) : "—"}</dd></div>
        </dl>
      </div>
    </div>
  );
}

/** Reprend le texte de l'e-mail envoyé à la création (src/lib/loans.ts, onLoanCreated). */
function MailPreview({ v, lender }: { v: LoanInput; lender: string }) {
  const money = v.kind === "MONEY";
  const cents = parseCents(v.amount);
  const item = v.item.trim();
  const amount = cents ? euros(cents) : "…";
  const what = money ? (item ? `${amount} (${item})` : amount) : `« ${item || "…"} »`;
  const subject = `${lender} vous a prêté ${money ? amount : `: ${item || "…"}`}`;
  return (
    <div className="mail-prev">
      <div className="mail-prev-head">
        <span className="ico"><Icon name="mail" size={15} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="mail-prev-subj truncate">{subject}</div>
          <div className="mail-prev-from truncate">Prêt Matériel · à {v.borrowerEmail || "l'emprunteur"}</div>
        </div>
      </div>
      <div className="mail-prev-body">
        <p>Bonjour {v.borrowerName.trim() || "…"},</p>
        <p>{lender} vous a prêté {what} le {longDate(v.lentAt)}.</p>
        <p>Merci de {money ? "le rembourser" : "le rendre"} avant le {longDate(v.dueAt)}.</p>
        <p>Vous recevrez un rappel si la date est dépassée.</p>
        <p className="mail-prev-foot">En pied d&apos;e-mail : pourquoi la personne le reçoit, et un lien pour ne plus recevoir ces e-mails.</p>
      </div>
    </div>
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
