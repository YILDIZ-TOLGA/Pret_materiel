"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { SignaturePad } from "@/components/SignaturePad";
import { SiteFooter } from "@/components/SiteFooter";
import { DayNight, Spinner, Stamp } from "@/components/ui";
import { sameAmountInFigures, sameAmountInWords } from "@/lib/amount-words";
import { api, dateFr, euros } from "@/lib/client";
import { DOC_TITLES, NAME_PLACEHOLDER, docBirth, lenderLabel, type DocKind } from "@/lib/receipt-text";
import { signatureProblem, type SignatureData } from "@/lib/signature";

type Doc = { id: string; number: string; kind: DocKind; signedAt: string };
type Data = {
  ackStatus: "NONE" | "PENDING" | "SIGNED" | "REFUSED"; ackAt: string | null; refusalReason: string | null; canSign: boolean;
  loan: { ref: string; kind: "OBJECT" | "MONEY"; item: string; description: string | null; amountCents: number | null; repaidCents: number; lentAt: string; dueAt: string; status: "ACTIVE" | "RETURNED"; returnedAt: string | null };
  lender: { organization: string | null; name: string; email: string };
  borrower: { name: string; email: string; birthDate: string | null };
  statement: string[];
  amountWords: string | null;
  documents: Doc[];
};

export default function Page() {
  return <Suspense><SignPage /></Suspense>;
}

/**
 * Page personnelle de l'emprunteur, ouverte depuis le lien reçu par e-mail (sans compte) : récapitulatif
 * complet du prêt, signature de l'accusé de réception ou contestation, copies des documents signés.
 * L'emprunteur est vouvoyé, comme dans les e-mails qu'il reçoit.
 */
function SignPage() {
  const t = useSearchParams().get("t") || "";
  const [data, setData] = useState<Data | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [name, setName] = useState("");
  const [words, setWords] = useState("");
  const [figures, setFigures] = useState("");
  const [sig, setSig] = useState<SignatureData | null>(null);
  const [accept, setAccept] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<"signed" | "refused" | null>(null);

  const load = useCallback(() => {
    if (!t) { setLoadErr("Lien incomplet : ouvrez la page depuis le bouton de l'e-mail reçu."); return; }
    api<Data>(`/api/sign?t=${encodeURIComponent(t)}`)
      .then((d) => { setData(d); setName((n) => n || d.borrower.name); })
      .catch((x) => setLoadErr((x as Error).message));
  }, [t]);
  useEffect(load, [load]);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const money = data.loan.kind === "MONEY" && !!data.loan.amountCents;
    const problem = !sig ? "Signez dans le cadre avant de valider." : "strokes" in sig ? signatureProblem(sig) : null;
    if (problem) { setErr(problem); return; }
    if (money && !sameAmountInWords(words, data.loan.amountCents!)) { setErr(`Écrivez la somme en toutes lettres : « ${data.amountWords} ».`); return; }
    if (money && !sameAmountInFigures(figures, data.loan.amountCents!)) { setErr("Écrivez la somme en chiffres, par exemple « 500 »."); return; }
    if (!accept) { setErr("Cochez la case pour signer l'accusé de réception."); return; }
    setBusy(true); setErr("");
    try {
      await api("/api/sign", { body: { t, action: "sign", signerName: name, signature: sig, accept: true, ...(money ? { amountWords: words, amountFigures: figures } : {}) } });
      setDone("signed");
      load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  async function refuse(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api("/api/sign", { body: { t, action: "refuse", reason: reason.trim() || null } });
      setDone("refused");
      setRefusing(false);
      load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <header className="legal-top">
        <div className="legal-top-in"><Brand href="/" /><DayNight /></div>
      </header>
      <main className="sign-page">
        {loadErr ? (
          <section className="stack">
            <h1>Lien non valable</h1>
            <div className="banner late" role="alert"><Icon name="alert" size={16} />{loadErr}</div>
            <p className="hint">Si le problème persiste, demandez au prêteur de vous renvoyer la demande depuis Prêt Matériel.</p>
          </section>
        ) : !data ? (
          <div aria-busy="true" aria-label="Chargement" className="stack">
            <div className="skel" style={{ width: 160, height: 12 }} /><div className="skel" style={{ width: "70%", height: 40 }} /><div className="card" style={{ height: 260 }} />
          </div>
        ) : content()}
      </main>
      <div style={{ marginTop: 48 }}><SiteFooter /></div>
    </>
  );

  // simple fonction (pas un composant) : un composant déclaré ici serait recréé à chaque frappe et ferait
  // perdre le focus des champs et le tracé de la signature
  function content() {
    const d = data!;
    const money = d.loan.kind === "MONEY" && !!d.loan.amountCents;
    const from = lenderLabel(d.lender);
    const closed = d.loan.status === "RETURNED";
    const statement = d.statement.map((p) => p.split(NAME_PLACEHOLDER));
    const title = d.ackStatus === "SIGNED" ? "Accusé de réception signé" : d.ackStatus === "REFUSED" ? "Prêt contesté" : d.ackStatus === "PENDING" && !closed ? "Accusé de réception à signer" : "Votre emprunt";
    return (
      <>
        <section>
          <div className="sign-kicker">{d.lender.organization ?? d.lender.name}</div>
          <h1>{title}</h1>
          <p className="sign-lead">
            {d.canSign
              ? <>{from} a enregistré un prêt à votre nom. Vérifiez le récapitulatif ci-dessous, puis signez l&apos;accusé de réception : cela prend une minute, sans créer de compte.</>
              : d.ackStatus === "SIGNED" ? <>Vous avez signé l&apos;accusé de réception le {dateFr(d.ackAt!)}. Vos documents sont téléchargeables en bas de page.</>
              : d.ackStatus === "REFUSED" ? <>Vous avez contesté ce prêt le {dateFr(d.ackAt!)}{d.refusalReason ? <> : « {d.refusalReason} »</> : ""}. {d.lender.organization ?? d.lender.name} en a été prévenu ; vous ne recevrez plus de rappel.</>
              : <>Récapitulatif du prêt enregistré par {from}.</>}
          </p>
        </section>

        {done === "signed" && (
          <div className="banner ok" role="status"><Icon name="check" size={16} /><span><strong>C&apos;est signé.</strong> Une copie du document vous a été envoyée par e-mail ; vous pouvez aussi la télécharger ci-dessous.</span></div>
        )}
        {done === "refused" && (
          <div className="banner ok" role="status"><Icon name="check" size={16} /><span>Votre contestation a été transmise au prêteur. Vous ne recevrez plus de rappel pour ce prêt.</span></div>
        )}

        <article className="fiche" aria-label="Récapitulatif du prêt">
          <div className={`fiche-part fiche-head ${d.ackStatus === "SIGNED" || closed ? "has-stamp" : ""}`}>
            <div className="fiche-top"><span>Fiche n° {d.loan.ref}</span><span className="sep">/</span><span>{money ? "Argent" : "Matériel"}</span></div>
            <div className="fiche-title">{money ? euros(d.loan.amountCents!) : d.loan.item}</div>
            {money && d.loan.item && d.loan.item !== "Prêt d'argent" && <p className="fiche-desc">{d.loan.item}</p>}
            {d.loan.description && <p className="fiche-desc">{d.loan.description}</p>}
            {(d.ackStatus === "SIGNED" || closed) && <div className="fiche-stamp"><Stamp size="lg">{closed ? (money ? "Soldé" : "Rendu") : "Signé"}</Stamp></div>}
          </div>
          <div className="fiche-part fiche-body">
            <dl className="fiche-grid">
              <div><dt>Prêté par</dt><dd style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>{d.lender.organization ?? d.lender.name}</span>{d.lender.organization && <span className="small muted">{d.lender.name}</span>}</dd></div>
              <div><dt>Emprunteur</dt><dd style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}><span>{d.borrower.name}</span>{d.borrower.birthDate && <span className="small muted">né(e) le {docBirth(d.borrower.birthDate)}</span>}<span className="small muted">{d.borrower.email}</span></dd></div>
              <div><dt>Prêté le</dt><dd className="mono">{dateFr(d.loan.lentAt)}</dd></div>
              <div><dt>{money ? "À rembourser le" : "À rendre le"}</dt><dd className="mono">{dateFr(d.loan.dueAt)}</dd></div>
              <div style={{ gridColumn: "1 / -1" }}><dt>Contacter le prêteur</dt><dd><a href={`mailto:${d.lender.email}`}>{d.lender.email}</a></dd></div>
            </dl>
            {money && d.loan.repaidCents > 0 && (
              <p className="small" style={{ margin: "18px 0 0", color: "var(--ink-2)" }}>
                Déjà remboursé : <strong>{euros(d.loan.repaidCents)}</strong> sur {euros(d.loan.amountCents!)}{closed ? "." : <> · reste dû : <strong>{euros(d.loan.amountCents! - d.loan.repaidCents)}</strong></>}
              </p>
            )}
          </div>
        </article>

        {d.canSign && !refusing && (
          <form className="card stack" onSubmit={sign} aria-labelledby="sign-title" noValidate>
            <h2 id="sign-title">Signer l&apos;accusé de réception</h2>
            {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Ce que vous signez</div>
              <div className="statement">
                {statement.map((parts, i) => (
                  <p key={i}>{parts.map((part, j) => <span key={j}>{j > 0 && <mark>{name.trim() || NAME_PLACEHOLDER}</mark>}{part}</span>)}</p>
                ))}
              </div>
            </div>
            <label className="field">Vos nom et prénom
              <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />
            </label>
            {money && (
              <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 10 }}>
                <legend className="section-label" style={{ marginBottom: 6 }}>La somme, écrite par vous</legend>
                <p className="hint" style={{ marginTop: -2 }}>Pour un prêt d&apos;argent, la loi demande que la somme soit écrite par l&apos;emprunteur lui-même, en toutes lettres et en chiffres (article 1376 du Code civil).</p>
                <label className="field">En toutes lettres
                  <input value={words} onChange={(e) => setWords(e.target.value)} placeholder={d.amountWords ?? ""} autoComplete="off" spellCheck={false} />
                  <span className="hint">À écrire : <strong>{d.amountWords}</strong>{words && (sameAmountInWords(words, d.loan.amountCents!) ? <span className="ok-text"> — correct</span> : null)}</span>
                </label>
                <label className="field">En chiffres
                  <span className="affix">
                    <input value={figures} onChange={(e) => setFigures(e.target.value)} inputMode="decimal" placeholder={(d.loan.amountCents! / 100).toFixed(d.loan.amountCents! % 100 ? 2 : 0).replace(".", ",")} autoComplete="off" />
                    <span className="affix-r">€</span>
                  </span>
                </label>
              </fieldset>
            )}
            <div>
              <div className="section-label" style={{ marginBottom: 8 }}>Votre signature</div>
              <SignaturePad value={sig} onChange={(s) => { setSig(s); setErr(""); }} name={name} />
            </div>
            <label className="check">
              <input type="checkbox" checked={accept} onChange={(e) => { setAccept(e.target.checked); setErr(""); }} />
              <span>J&apos;ai lu le récapitulatif, je reconnais avoir reçu ce prêt et je signe électroniquement cet accusé de réception. Ma signature, la date, l&apos;heure, mon adresse IP et mon navigateur sont enregistrés comme preuve.</span>
            </label>
            <button className="btn primary lg block" disabled={busy}>{busy ? <><Spinner />Signature…</> : "Signer l'accusé de réception"}</button>
            <p className="hint" style={{ textAlign: "center" }}>Ce prêt ne vous concerne pas ou comporte une erreur ? <button type="button" className="link-btn" onClick={() => { setRefusing(true); setErr(""); }}>Contester ce prêt</button></p>
          </form>
        )}

        {d.canSign && refusing && (
          <form className="card stack danger-zone" onSubmit={refuse} aria-labelledby="refuse-title">
            <h2 id="refuse-title">Contester ce prêt</h2>
            {err && <div className="banner late" role="alert"><Icon name="alert" size={16} />{err}</div>}
            <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>
              {from} sera prévenu que vous contestez ce prêt, et vous ne recevrez plus de rappel. S&apos;il s&apos;agit d&apos;une erreur de saisie, il pourra la corriger et vous envoyer une nouvelle demande.
            </p>
            <label className="field"><span>Motif <span className="opt">— facultatif, transmis au prêteur</span></span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} placeholder="Je n'ai jamais emprunté cela, le montant est faux…" />
            </label>
            <div className="row">
              <button className="btn danger solid" disabled={busy}>{busy ? <><Spinner />Envoi…</> : "Contester le prêt"}</button>
              <button type="button" className="btn ghost" onClick={() => setRefusing(false)} disabled={busy}>Retour à la signature</button>
            </div>
          </form>
        )}

        {d.documents.length > 0 && (
          <section className="card flush" aria-labelledby="docs-title">
            <div className="card-head"><h2 id="docs-title">Vos documents signés</h2></div>
            <ul className="docs">
              {d.documents.map((doc) => (
                <li key={doc.id} className="doc">
                  <span className="doc-ico"><Icon name="file" size={17} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="doc-title">{DOC_TITLES[doc.kind]}</div>
                    <div className="doc-meta">n° {doc.number} · {dateFr(doc.signedAt)}</div>
                  </div>
                  <a className="btn small" href={`/api/sign/pdf?t=${encodeURIComponent(t)}&r=${doc.id}`} download={`${doc.number}.pdf`}><Icon name="download" size={14} />PDF</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="hint">
          {d.lender.organization ?? d.lender.name} est responsable des données de ce prêt ; Prêt Matériel les traite pour son compte, uniquement pour l&apos;accusé de réception, les reçus et les rappels.
          Les éléments de signature (nom, tracé, date, adresse IP, navigateur) sont conservés avec le prêt, comme preuve, au plus cinq ans après sa clôture.
          {" "}Vos droits : <Link href="/confidentialite">politique de confidentialité</Link>. Ne plus recevoir d&apos;e-mails : lien en bas de chaque e-mail.
        </p>
      </>
    );
  }
}
