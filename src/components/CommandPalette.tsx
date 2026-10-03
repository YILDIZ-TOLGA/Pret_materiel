"use client";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, loanTitle, norm } from "@/lib/client";
import { Icon, type IconName } from "./Icon";
import type { LoanDTO } from "./LoanList";
import { DueChip } from "./ui";

type Item = { id: string; group: string; label: string; sub?: string; icon: IconName; href: string; right?: React.ReactNode; keywords?: string };

const PAGES: Item[] = [
  { id: "new", group: "Actions", label: "Nouveau prêt", icon: "plus", href: "/prets/nouveau", keywords: "ajouter creer enregistrer preter noter", right: <kbd>N</kbd> },
  { id: "p-prets", group: "Aller à", label: "Prêts", icon: "ticket", href: "/prets", keywords: "liste en cours carnet" },
  { id: "p-late", group: "Aller à", label: "Prêts en retard", icon: "alert", href: "/prets?vue=retard", keywords: "retard relancer relance" },
  { id: "p-bilan", group: "Aller à", label: "Bilan", icon: "chart", href: "/bilan", keywords: "statistiques tableau de bord export csv personnes" },
  { id: "p-emprunts", group: "Aller à", label: "Emprunts", icon: "inbox", href: "/emprunts", keywords: "on m'a prete" },
  { id: "p-alertes", group: "Aller à", label: "Alertes", icon: "bell", href: "/notifications", keywords: "notifications" },
  { id: "p-offre", group: "Aller à", label: "Offre et facturation", icon: "card", href: "/abonnement", keywords: "abonnement paiement factures resilier" },
  { id: "p-compte", group: "Aller à", label: "Mon compte", icon: "user", href: "/compte", keywords: "profil donnees exporter supprimer theme" },
];
const ADMIN: Item[] = [
  { id: "p-admin", group: "Aller à", label: "Administration", icon: "shield", href: "/admin", keywords: "admin revenus trafic" },
  { id: "p-users", group: "Aller à", label: "Utilisateurs", icon: "users", href: "/admin/utilisateurs", keywords: "admin comptes" },
];

/** Recherche globale : prêts (objet, montant, personne) et pages. Ctrl/⌘ K ou / pour l'ouvrir. */
export function CommandPalette({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const router = useRouter();
  const [render, setRender] = useState(open);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [loans, setLoans] = useState<LoanDTO[] | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement | null;
      setRender(true);
      setQ("");
      setSel(0);
      api<{ loans: LoanDTO[] }>("/api/loans").then((r) => setLoans(r.loans)).catch(() => setLoans([]));
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
    const t = setTimeout(() => { setRender(false); lastFocus.current?.focus?.(); }, 160);
    return () => clearTimeout(t);
  }, [open]);

  const items = useMemo(() => {
    const nq = norm(q.trim());
    const pages = [...PAGES, ...(isAdmin ? ADMIN : [])].filter((p) => !nq || norm(`${p.label} ${p.keywords ?? ""}`).includes(nq));
    const found = (loans ?? [])
      .filter((l) => (nq ? norm(`${loanTitle(l)} ${l.borrowerName} ${l.borrowerEmail}`).includes(nq) : l.status === "ACTIVE"))
      .slice(0, nq ? 8 : 5)
      .map<Item>((l) => ({
        id: l.id, group: nq ? "Prêts" : "Prochaines échéances", label: loanTitle(l), sub: l.borrowerName,
        icon: l.kind === "MONEY" ? "banknote" : "box", href: `/prets/${l.id}`, right: <DueChip loan={l} />,
      }));
    return nq ? [...found, ...pages] : [...pages.slice(0, 1), ...found, ...pages.slice(1)];
  }, [q, loans, isAdmin]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { list.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  function go(it: Item) {
    onClose();
    router.push(it.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (items[sel]) go(items[sel]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "Tab") e.preventDefault();
  }

  if (!render) return null;
  let group = "";
  return (
    <div className={`overlay top ${open ? "" : "closing"}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Recherche">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Rechercher un prêt, une personne, une page…" role="combobox" aria-expanded="true" aria-controls="palette-list"
            aria-activedescendant={items[sel] ? `pi-${items[sel].id}` : undefined} autoComplete="off" spellCheck={false} />
          <kbd>Échap</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={list}>
          {items.length === 0
            ? <div className="palette-empty">{loans === null ? "Recherche…" : <>Aucun résultat pour « {q.trim()} »</>}</div>
            : items.map((it, i) => {
                const head = it.group !== group ? <div className="palette-group">{(group = it.group)}</div> : null;
                return (
                  <Fragment key={it.id}>
                    {head}
                    <div id={`pi-${it.id}`} data-idx={i} role="option" aria-selected={i === sel} className="palette-item"
                      onMouseMove={() => { if (sel !== i) setSel(i); }} onClick={() => go(it)}>
                      <Icon name={it.icon} size={17} />
                      <span className="pi-main">{it.label}{it.sub && <span className="pi-sub"> · {it.sub}</span>}</span>
                      {it.right}
                    </div>
                  </Fragment>
                );
              })}
        </div>
        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd>naviguer</span>
          <span><kbd>↵</kbd>ouvrir</span>
          <span><kbd>Échap</kbd>fermer</span>
        </div>
      </div>
    </div>
  );
}
