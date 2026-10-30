"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Brand } from "./Brand";
import { CommandPalette } from "./CommandPalette";
import { Icon, type IconName } from "./Icon";
import { useMe, type Me } from "./Providers";
import { Avatar, DayNight, Menu, Meter, SkeletonRows, Spinner, ThemeSwitch } from "./ui";
import { api } from "@/lib/client";
import { B2B_TERMS_VERSION } from "@/lib/legal";
import { PaidSwitchBanner } from "./SiteMode";

export { Brand } from "./Brand";

/** Pages de l'espace connecté : elles reçoivent la coquille (barre latérale, navigation mobile). */
const APP_ROUTES = ["/prets", "/bilan", "/emprunts", "/notifications", "/abonnement", "/compte", "/admin"];
export const isAppRoute = (p: string) => APP_ROUTES.some((r) => p === r || p.startsWith(r + "/"));

/**
 * Posée par le layout racine : la coquille persiste d'une page à l'autre, l'indicateur de
 * navigation glisse vers la nouvelle page au lieu de tout redessiner.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (!isAppRoute(path)) return <>{children}</>;
  const admin = path === "/admin" || path.startsWith("/admin/");
  return <Shell admin={admin}>{children}</Shell>;
}

/** Conservé pour compatibilité : la coquille est désormais posée par AppFrame. */
export function AppShell({ children }: { children: React.ReactNode; wide?: boolean; admin?: boolean }) {
  return <>{children}</>;
}

function useModKey() {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => { if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setMod("⌘"); }, []);
  return mod;
}

function Shell({ children, admin }: { children: React.ReactNode; admin: boolean }) {
  const { me, loading, logout } = useMe();
  const path = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace(`/connexion?next=${encodeURIComponent(path)}`);
    if (!loading && me && admin && me.user.role !== "ADMIN") router.replace("/prets");
  }, [loading, me, admin, path, router]);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Raccourcis : Ctrl/⌘ K (recherche globale), N (nouveau prêt), / (recherche de la page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']") || document.querySelector(".overlay")) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); router.push("/prets/nouveau"); }
      if (e.key === "/") {
        e.preventDefault();
        const s = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (s) s.focus(); else setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const ready = !loading && !!me && !(admin && me.user.role !== "ADMIN");
  return (
    <div className="app">
      <Sidebar me={me} path={path} onSearch={() => setPalette(true)} logout={logout} />
      <div style={{ minWidth: 0 }}>
        <header className={`mtop ${scrolled ? "scrolled" : ""}`}>
          <Brand />
          <span className="spacer" />
          <DayNight />
          <button type="button" className="icon-btn" aria-label="Rechercher" onClick={() => setPalette(true)}><Icon name="search" size={19} /></button>
          {me && <UserMenu me={me} logout={logout} side="bottom" align="end" compact />}
        </header>
        <main className="main">
          <div className={`main-inner ${admin ? "wide" : ""}`}>{ready ? <>{!me.user.emailVerifiedAt && <VerifyBanner me={me} />}{me.termsUpToDate === false && <TermsBanner me={me} />}{me.site?.paidFrom && <PaidSwitchBanner paidFrom={me.site.paidFrom} />}{children}</> : <Boot />}</div>
        </main>
      </div>
      <TabBar me={me} path={path} />
      {me && <CommandPalette open={palette} onClose={() => setPalette(false)} isAdmin={me.user.role === "ADMIN"} />}
    </div>
  );
}

/** Tant que l'adresse n'est pas confirmée : pas de nouveau prêt ni d'emprunts visibles. */
function VerifyBanner({ me }: { me: Me }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [err, setErr] = useState("");
  const to = me.user.pendingEmail ?? me.user.email;
  async function resend() {
    setState("busy"); setErr("");
    try { await api("/api/auth/resend-verification", { method: "POST" }); setState("sent"); }
    catch (x) { setErr((x as Error).message); setState("idle"); }
  }
  return (
    <div className="banner soon" role="status" style={{ marginBottom: 20, flexWrap: "wrap" }}>
      <Icon name="mail" size={16} />
      <span style={{ flex: "1 1 260px" }}>
        {state === "sent" ? <>Nouveau lien envoyé à <strong>{to}</strong>.</> : <>Confirme ton adresse avec le lien envoyé à <strong>{to}</strong> pour enregistrer des prêts.</>}
        {err && <> {err}</>}
        {" "}<Link href="/compte">Mauvaise adresse ?</Link>
      </span>
      {state !== "sent" && <button type="button" className="btn small" onClick={resend} disabled={state === "busy"}>{state === "busy" ? <><Spinner />Envoi…</> : "Renvoyer le lien"}</button>}
    </div>
  );
}

/**
 * Compte ouvert avant le passage au service pour les professionnels : nouvelles conditions à accepter (avec le
 * nom de la structure) pour enregistrer de nouveaux prêts. Les prêts existants restent accessibles sans rien faire.
 */
function TermsBanner({ me }: { me: Me }) {
  const { refresh } = useMe();
  const [org, setOrg] = useState(me.user.organization ?? "");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api("/api/account/terms", { body: { acceptTerms: true, ...(org.trim() ? { organization: org.trim() } : {}) } }); await refresh(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <form className="banner soon" role="region" aria-label="Nouvelles conditions" style={{ marginBottom: 20, flexWrap: "wrap" }} onSubmit={submit}>
      <Icon name="info" size={16} />
      <div className="stack" style={{ flex: "1 1 300px", gap: 10 }}>
        {/* compte qui a déjà accepté les conditions réservées aux professionnels : seule l'identité de l'emprunteur change */}
        {me.user.termsVersion && me.user.termsVersion >= B2B_TERMS_VERSION ? (
          <span>
            <strong>Conditions mises à jour : identité de l&apos;emprunteur.</strong> Chaque prêt indique désormais le prénom, le nom et la date de naissance de l&apos;emprunteur, qui doit être majeur : ils figurent sur l&apos;accusé de réception et les reçus. Lis les <Link href="/cgu" target="_blank">nouvelles conditions</Link> (articles 3 et 17) : pour enregistrer de nouveaux prêts, il faut les accepter.
          </span>
        ) : (
          <span>
            <strong>Prêt Matériel devient un service pour les professionnels.</strong> L&apos;emprunteur signe un accusé de réception en ligne, chaque remboursement ou retour donne un reçu signé à imprimer, et l&apos;offre devient unique. Lis les <Link href="/cgu" target="_blank">nouvelles conditions</Link> : tes prêts sont conservés, mais pour en enregistrer de nouveaux il faut les accepter.
          </span>
        )}
        {!me.user.organization && (
          <label className="field">Nom de ta structure <span className="opt">— entreprise, association…</span>
            <input value={org} onChange={(e) => setOrg(e.target.value)} required maxLength={120} autoComplete="organization" />
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>J&apos;utilise ce compte pour une entreprise, une association ou un autre organisme, dans le cadre de son activité, et j&apos;accepte les nouvelles conditions générales.</span>
        </label>
        {err && <span className="small late-text" role="alert">{err}</span>}
      </div>
      <button className="btn small" disabled={busy || !accept || (!me.user.organization && !org.trim())}>{busy ? <><Spinner />Un instant…</> : "Accepter"}</button>
    </form>
  );
}

function Boot() {
  return (
    <div aria-busy="true" aria-label="Chargement">
      <div className="skel" style={{ width: 200, height: 38, marginBottom: 14 }} />
      <div className="skel" style={{ width: 280, height: 12, marginBottom: 36, opacity: .7 }} />
      <SkeletonRows n={4} />
    </div>
  );
}

function Sidebar({ me, path, onSearch, logout }: { me: Me | null; path: string; onSearch: () => void; logout: () => void }) {
  const nav = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ y: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const mod = useModKey();
  const isAdmin = me?.user.role === "ADMIN";
  const on = (href: string) => path === href || path.startsWith(href + "/");

  useLayoutEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setInd(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [path, isAdmin]);
  useEffect(() => {
    if (!ind || ready) return;
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, [ind, ready]);

  const late = me?.overdueLoans ?? 0;
  return (
    <aside className="sb">
      <div className="sb-brand"><Brand /><DayNight /></div>
      <div className="sb-quick">
        <Link href="/prets/nouveau" className="btn primary block sb-new"><Icon name="plus" size={16} />Nouveau prêt<kbd>N</kbd></Link>
        <button type="button" className="sb-search" onClick={onSearch}><Icon name="search" size={15} />Rechercher<kbd>{mod} K</kbd></button>
      </div>
      <nav ref={nav} className={`sb-nav ${ready ? "ready" : ""}`} aria-label="Navigation principale"
        style={ind ? ({ "--y": `${ind.y}px`, "--h": `${ind.h}px` } as React.CSSProperties) : undefined}>
        <span className="sb-ind" aria-hidden="true" />
        <div className="sb-label">Suivi</div>
        <NavLink href="/prets" icon="ticket" label="Prêts" current={on("/prets")}>
          {me && (late > 0
            ? <span className="sb-count" title={`${late} en retard`}><span className="late">{late}</span></span>
            : me.activeLoans > 0 && <span className="sb-count">{me.activeLoans}</span>)}
        </NavLink>
        <NavLink href="/bilan" icon="chart" label="Bilan" current={on("/bilan")} />
        <NavLink href="/emprunts" icon="inbox" label="Emprunts" current={on("/emprunts")} />
        <NavLink href="/notifications" icon="bell" label="Alertes" current={on("/notifications")}>
          {!!me?.unread && <span className="sb-badge">{me.unread}</span>}
        </NavLink>
        <div className="sb-label">Compte</div>
        <NavLink href="/abonnement" icon="card" label="Offre" current={on("/abonnement")} />
        <NavLink href="/compte" icon="user" label="Mon compte" current={on("/compte")} />
        {isAdmin && <NavLink href="/admin" icon="shield" label="Administration" current={on("/admin")} />}
      </nav>
      {me && (
        <div className="sb-foot">
          <Link href="/abonnement" className="sb-plan">
            <div className="sb-plan-top">
              <span>{me.site?.mode === "BETA" && me.plan.id === "FREE" ? "Phase de test gratuite" : me.plan.id === "FREE" ? "Sans abonnement" : `Offre ${me.plan.name}`}</span>
              {me.plan.maxLoans > 0 && <span className="mono">{me.activeLoans}/{me.plan.maxLoans}</span>}
            </div>
            {me.plan.maxLoans > 0 && <Meter value={me.activeLoans / me.plan.maxLoans} tone={me.activeLoans >= me.plan.maxLoans ? "full" : undefined} />}
            {me.plan.id === "FREE" && me.site?.mode !== "BETA" && <span className="sb-plan-cta">S&apos;abonner pour enregistrer des prêts<Icon name="arrowRight" size={13} /></span>}
          </Link>
          <UserMenu me={me} logout={logout} side="top" align="start" />
        </div>
      )}
    </aside>
  );
}

function NavLink({ href, icon, label, current, children }: { href: string; icon: IconName; label: string; current: boolean; children?: React.ReactNode }) {
  return (
    <Link href={href} className="sb-link" aria-current={current ? "page" : undefined}>
      <Icon name={icon} size={17} />{label}{children}
    </Link>
  );
}

function UserMenu({ me, logout, side, align, compact }: { me: Me; logout: () => void; side: "top" | "bottom"; align: "start" | "end"; compact?: boolean }) {
  const button = compact
    ? <Avatar name={me.user.name} size="sm" />
    : <><Avatar name={me.user.name} size="sm" /><span className="sb-user-txt"><b>{me.user.name}</b><span>{me.user.email}</span></span><Icon name="chevronsUpDown" size={15} /></>;
  return (
    <Menu label="Mon compte" side={side} align={align} stretch={!compact} buttonClass={compact ? "icon-btn" : "sb-user"} button={button}>
      {(close) => (
        <>
          {compact && <><div className="menu-head"><b>{me.user.name}</b><span>{me.user.email}</span></div><div className="menu-sep" /></>}
          <Link href="/compte" className="menu-item" role="menuitem" onClick={close}><Icon name="user" size={16} />Mon compte</Link>
          <Link href="/abonnement" className="menu-item" role="menuitem" onClick={close}><Icon name="card" size={16} />Offre et facturation</Link>
          {compact && me.user.role === "ADMIN" && <Link href="/admin" className="menu-item" role="menuitem" onClick={close}><Icon name="shield" size={16} />Administration</Link>}
          <div className="menu-sep" />
          <div className="menu-label">Mode jour / nuit</div>
          <ThemeSwitch />
          <div className="menu-sep" />
          <button type="button" className="menu-item" role="menuitem" onClick={() => { close(); logout(); }}><Icon name="logout" size={16} />Se déconnecter</button>
        </>
      )}
    </Menu>
  );
}

function TabBar({ me, path }: { me: Me | null; path: string }) {
  const loans = path === "/prets" || (path.startsWith("/prets/") && path !== "/prets/nouveau");
  return (
    <nav className="tabbar" aria-label="Navigation">
      <Tab href="/prets" icon="ticket" label="Prêts" current={loans} dot={me?.overdueLoans} />
      <Tab href="/bilan" icon="chart" label="Bilan" current={path.startsWith("/bilan")} />
      <Link href="/prets/nouveau" className="tab-new" aria-label="Nouveau prêt" aria-current={path === "/prets/nouveau" ? "page" : undefined}>
        <Icon name="plus" size={24} stroke={2.1} />
      </Link>
      <Tab href="/emprunts" icon="inbox" label="Emprunts" current={path.startsWith("/emprunts")} />
      <Tab href="/notifications" icon="bell" label="Alertes" current={path.startsWith("/notifications")} dot={me?.unread} />
    </nav>
  );
}

function Tab({ href, icon, label, current, dot }: { href: string; icon: IconName; label: string; current: boolean; dot?: number }) {
  return (
    <Link href={href} className="tab" aria-current={current ? "page" : undefined}>
      <Icon name={icon} size={21} />{label}
      {!!dot && <span className="tab-dot">{dot > 9 ? "9+" : dot}</span>}
    </Link>
  );
}
