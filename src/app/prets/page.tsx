"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { LoanRow, type LoanDTO } from "@/components/LoanList";
import { useMe } from "@/components/Providers";
import { useToast } from "@/components/Toast";
import { Avatar, EmptyState, PageHeader, Segmented, SkeletonRows } from "@/components/ui";
import { api, dateShort, dueInfo, euros, isMoney, loanTitle, norm, relTime, remainingCents } from "@/lib/client";

type View = "ACTIVE" | "LATE" | "RETURNED";

export default function LoansPage() {
  return <Suspense><Loans /></Suspense>;
}

function Loans() {
  const { me, refresh } = useMe();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const [loans, setLoans] = useState<LoanDTO[] | null>(null);
  const [view, setView] = useState<View>(sp.get("vue") === "retard" ? "LATE" : sp.get("vue") === "clotures" ? "RETURNED" : "ACTIVE");
  const [q, setQ] = useState("");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  const load = useCallback(() => api<{ loans: LoanDTO[] }>("/api/loans").then((r) => setLoans(r.loans)).catch(() => setLoans([])), []);
  useEffect(() => { load(); }, [load]);

  const changeView = (v: View) => {
    setView(v);
    router.replace(v === "ACTIVE" ? "/prets" : `/prets?vue=${v === "LATE" ? "retard" : "clotures"}`, { scroll: false });
  };

  const all = useMemo(() => loans ?? [], [loans]);
  const active = all.filter((l) => l.status === "ACTIVE");
  const late = active.filter((l) => dueInfo(l).tone === "late");
  const returned = all.filter((l) => l.status === "RETURNED").sort((a, b) => (b.returnedAt ?? "").localeCompare(a.returnedAt ?? ""));
  const owed = active.reduce((a, l) => a + remainingCents(l), 0);
  const nq = norm(q.trim());
  const match = (l: LoanDTO) => !nq || norm(`${loanTitle(l)} ${l.borrowerName} ${l.borrowerEmail} ${l.description ?? ""}`).includes(nq);

  if (!me) return null;
  const full = me.activeLoans >= me.plan.maxLoans;

  /** Clôture différée : la ligne part tout de suite, l'enregistrement attend la fin du délai d'annulation. */
  function close(l: LoanDTO) {
    setLeaving((s) => new Set(s).add(l.id));
    const t = setTimeout(() => {
      setLoans((ls) => ls && ls.map((x): LoanDTO => (x.id === l.id ? { ...x, status: "RETURNED", returnedAt: new Date().toISOString(), repaidCents: x.amountCents ?? x.repaidCents } : x)));
      setLeaving((s) => { const n = new Set(s); n.delete(l.id); return n; });
    }, 340);
    toast.defer({
      text: isMoney(l) ? `Prêt soldé : ${loanTitle(l)}` : `Prêt clôturé : « ${l.item} »`,
      run: async () => { await api(`/api/loans/${l.id}`, { method: "PATCH", body: { action: "return" } }); await refresh(); },
      onUndo: () => {
        clearTimeout(t);
        setLeaving((s) => { const n = new Set(s); n.delete(l.id); return n; });
        setLoans((ls) => ls && ls.map((x) => (x.id === l.id ? l : x)));
      },
      onError: () => { load(); },
    });
  }

  function remind(l: LoanDTO) {
    toast.defer({
      text: `Relance envoyée à ${l.borrowerName}`,
      delay: 4000,
      run: async () => {
        await api(`/api/loans/${l.id}/remind`, { method: "POST" });
        setLoans((ls) => ls && ls.map((x): LoanDTO => (x.id === l.id ? { ...x, lastReminderAt: new Date().toISOString(), reminderCount: x.reminderCount + 1 } : x)));
      },
    });
  }

  const meta = (l: LoanDTO) => (
    <>
      <Avatar name={l.borrowerName} size="xs" />
      <span className="truncate">{l.borrowerName}</span>
      <span className="sep">·</span>
      <span className="nowrap">{l.status === "RETURNED" && l.returnedAt ? `${isMoney(l) ? "soldé" : "rendu"} le ${dateShort(l.returnedAt)}` : `prêté le ${dateShort(l.lentAt)}`}</span>
      {l.status === "ACTIVE" && l.lastReminderAt && <><span className="sep">·</span><span className="nowrap">relancé {relTime(l.lastReminderAt)}</span></>}
    </>
  );

  const actions = (l: LoanDTO) => (
    <>
      {dueInfo(l).tone === "late" && (
        <button type="button" className="btn small" data-tip="Envoyer une relance par e-mail" onClick={() => remind(l)}><Icon name="send" size={14} />Relancer</button>
      )}
      <button type="button" className="btn small" data-tip={isMoney(l) ? "Tout a été remboursé" : "L'objet est revenu"} onClick={() => close(l)}>
        <Icon name="check" size={14} />{isMoney(l) ? "Soldé" : "Rendu"}
      </button>
    </>
  );

  const rows = (list: LoanDTO[], withActions: boolean) => (
    <div className="lrows">
      {list.map((l, i) => (
        <LoanRow key={l.id} loan={l} index={i} href={`/prets/${l.id}`} who={meta(l)} leaving={leaving.has(l.id)} actions={withActions ? actions(l) : undefined} />
      ))}
    </div>
  );

  const groups = (() => {
    if (view === "LATE") return [{ key: "late", label: "En retard", tone: "late", list: late.filter(match) }];
    if (view === "RETURNED") {
      const byMonth = new Map<string, LoanDTO[]>();
      for (const l of returned.filter(match)) {
        const k = new Date(l.returnedAt ?? l.dueAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
        byMonth.set(k, [...(byMonth.get(k) ?? []), l]);
      }
      return [...byMonth].map(([k, list]) => ({ key: k, label: k, tone: "", list }));
    }
    const shown = active.filter(match);
    return [
      { key: "late", label: "En retard", tone: "late", list: shown.filter((l) => dueInfo(l).tone === "late") },
      { key: "week", label: "Cette semaine", tone: "", list: shown.filter((l) => { const d = dueInfo(l); return d.tone !== "late" && d.days <= 7; }) },
      { key: "later", label: "Plus tard", tone: "", list: shown.filter((l) => dueInfo(l).days > 7) },
    ].filter((g) => g.list.length);
  })();

  const sub = loans === null ? "Chargement…" : (
    <>
      {active.length} en cours
      {late.length > 0 && <> · <span className="late-text">{late.length} en retard</span></>}
      {owed > 0 && <> · {euros(owed)} à récupérer</>}
    </>
  );

  return (
    <>
      <PageHeader title="Prêts" sub={sub} actions={
        <>
          {all.length > 3 && (
            <label className="search ph-search">
              <span className="sr-only">Rechercher</span>
              <Icon name="search" size={15} />
              <input data-page-search value={q} onChange={(e) => setQ(e.target.value)} placeholder="Objet, montant, personne…" onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); } }} />
              <kbd>/</kbd>
            </label>
          )}
          {full
            ? <Link href="/abonnement" className="btn primary">Augmenter la limite</Link>
            : <Link href="/prets/nouveau" className="btn primary hide-m"><Icon name="plus" size={16} />Nouveau prêt</Link>}
        </>
      } />

      {full && (
        <div className="banner soon" style={{ marginBottom: 20 }}>
          <Icon name="info" size={16} />
          <span><strong>Limite de ton offre atteinte</strong> — {me.activeLoans} prêt{me.activeLoans > 1 ? "s" : ""} en cours sur {me.plan.maxLoans}. Clôture un prêt rendu ou passe à l&apos;offre supérieure.</span>
          <Link href="/abonnement" className="btn small">Voir les offres</Link>
        </div>
      )}

      <div className="row" style={{ marginBottom: 22, justifyContent: "space-between" }}>
        <Segmented<View> value={view} onChange={changeView} label="Filtrer les prêts" options={[
          { value: "ACTIVE", label: "En cours", count: active.length },
          { value: "LATE", label: "En retard", count: late.length, tone: late.length ? "late" : undefined },
          { value: "RETURNED", label: "Clôturés", count: returned.length },
        ]} />
      </div>

      {loans === null ? <SkeletonRows n={4} /> : groups.length === 0 ? (
        <div className="card flush">
          {nq ? (
            <EmptyState title="Aucun résultat">Aucun prêt ne correspond à « {q.trim()} ».</EmptyState>
          ) : view === "ACTIVE" ? (
            <EmptyState title={all.length ? "Tout est rentré" : "Ton carnet est vide"} action={<Link href="/prets/nouveau" className="btn primary"><Icon name="plus" size={16} />Noter un prêt</Link>}>
              {all.length ? "Aucun prêt en cours : tout ce que tu as prêté est revenu." : "Note ce que tu prêtes, à qui et jusqu'à quand. Les rappels partent automatiquement."}
            </EmptyState>
          ) : view === "LATE" ? (
            <EmptyState title="Aucun retard">Tous tes prêts en cours sont dans les temps.</EmptyState>
          ) : (
            <EmptyState title="Rien de clôturé">Les prêts rendus ou remboursés apparaîtront ici.</EmptyState>
          )}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="lgroup">
            <h2 className={`section-label ${g.tone}`}>{g.label}<span className="n">{g.list.length}</span></h2>
            {rows(g.list, view !== "RETURNED")}
          </section>
        ))
      )}
    </>
  );
}
