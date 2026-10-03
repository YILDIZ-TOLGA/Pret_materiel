"use client";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { dueInfo, hue, initials } from "@/lib/client";
import { Icon } from "./Icon";

type Css = React.CSSProperties & Record<`--${string}`, string | number>;

/* ---------- Contrôle segmenté à indicateur glissant ---------- */
export function Segmented<T extends string>({ value, onChange, options, full, size, label }: {
  value: T; onChange: (v: T) => void; full?: boolean; size?: "lg"; label?: string;
  options: { value: T; label: React.ReactNode; count?: number; tone?: "late"; icon?: React.ReactNode; title?: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !el) return;
    const measure = () => setInd({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, options.length]);
  useEffect(() => {
    if (!ind || ready) return;
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, [ind, ready]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(next.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
  }

  return (
    <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKey}
      className={`seg ${full ? "full" : ""} ${size ?? ""} ${ready ? "ready" : ""}`}
      style={ind ? ({ "--x": `${ind.x}px`, "--w": `${ind.w}px` } as Css) : undefined}>
      <span className="seg-ind" aria-hidden="true" />
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className="seg-btn" title={o.title} onClick={() => onChange(o.value)}>
            {o.icon}{o.label}
            {o.count !== undefined && <span className={`seg-count ${o.tone ?? ""}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Interrupteur ---------- */
export function Switch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)} />;
}

/* ---------- Nombre qui défile jusqu'à sa valeur ---------- */
const fmtInt = (n: number) => Math.round(n).toLocaleString("fr-FR");
export function CountUp({ value, format = fmtInt, duration = 1100, run = true }: { value: number; format?: (n: number) => string; duration?: number; run?: boolean }) {
  const [n, setN] = useState(value);
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { shown.current = value; setN(value); return; }
    if (!run) { if (shown.current === null) setN(0); return; }
    const from = shown.current ?? 0;
    if (from === value) { setN(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 4));
      shown.current = v;
      setN(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setN(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, run, duration]);
  return <>{format(n)}</>;
}

/* ---------- Apparition au défilement ---------- */
export function useInView<T extends HTMLElement>(margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } }, { rootMargin: margin, threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, inView] as const;
}

export function Reveal({ children, delay = 0, className = "", as = "div", ...rest }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" } & React.HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>();
  const Tag = as as "div";
  return <Tag ref={ref as React.Ref<HTMLDivElement>} className={`reveal ${inView ? "in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as Css} {...rest}>{children}</Tag>;
}

/* ---------- Pastilles ---------- */
export function Avatar({ name, size }: { name: string; size?: "xs" | "sm" | "lg" }) {
  return <span className={`avatar ${size ?? ""}`} style={{ "--h": hue(name) } as Css} aria-hidden="true">{initials(name)}</span>;
}

export function DueChip({ loan }: { loan: { dueAt: string; status: string; kind?: string } }) {
  const d = dueInfo(loan);
  return <span className={`due ${d.tone}`} title={d.long}>{d.short}</span>;
}

export function Stamp({ children, tone, state, size }: { children: React.ReactNode; tone?: "late" | "soon"; state?: "in" | "out"; size?: "lg" }) {
  return <span className={`stamp ${tone ?? ""} ${state ?? ""} ${size ?? ""}`} aria-hidden="true">{children}</span>;
}

export function Meter({ value, tone }: { value: number; tone?: "late" | "soon" | "full" }) {
  return <div className={`meter ${tone ?? ""}`} aria-hidden="true"><i style={{ "--v": `${Math.max(0, Math.min(1, value)) * 100}%` } as Css} /></div>;
}

export function Spinner() { return <span className="spin" aria-hidden="true" />; }

/* ---------- Mise en page ---------- */
export function PageHeader({ title, sub, actions, crumb }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; crumb?: { href: string; label: string } }) {
  return (
    <header className="ph">
      <div className="ph-main">
        {crumb && <Link href={crumb.href} className="crumb"><Icon name="arrowLeft" size={14} />{crumb.label}</Link>}
        <h1 className="ph-title">{title}</h1>
        {sub && <p className="ph-sub">{sub}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
    </header>
  );
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="lrows" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skel-row" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="skel" />
          <span className="skel-lines"><span className="skel" /><span className="skel" /></span>
          <span className="skel" />
        </div>
      ))}
    </div>
  );
}

export function EmptyArt() {
  return (
    <svg className="empty-art" viewBox="0 0 132 96" fill="none" aria-hidden="true">
      <path d="M22 22H102A8 8 0 0 1 110 30V44A6 6 0 0 0 110 56V74A8 8 0 0 1 102 82H22A8 8 0 0 1 14 74V56A6 6 0 0 0 14 44V30A8 8 0 0 1 22 22Z" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M22 50H102" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      <rect x="24" y="30" width="44" height="7" rx="3.5" fill="currentColor" />
      <rect x="24" y="41" width="26" height="4" rx="2" fill="currentColor" opacity=".55" />
      <rect x="24" y="61" width="32" height="4" rx="2" fill="currentColor" opacity=".55" />
      <rect x="24" y="70" width="20" height="4" rx="2" fill="currentColor" opacity=".55" />
      <rect x="78" y="62" width="22" height="10" rx="3" fill="currentColor" opacity=".35" />
      <g className="swing accent">
        <path d="M100 4V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M94 16h12a2 2 0 0 1 2 2v13l-8 6-8-6V18a2 2 0 0 1 2-2Z" fill="currentColor" />
        <circle cx="100" cy="22" r="2" fill="var(--surface)" />
      </g>
    </svg>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <EmptyArt />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/* ---------- Menu déroulant ---------- */
/** Menu en position fixe (jamais rogné par un conteneur défilant), fermé au défilement, à Échap ou au clic extérieur. */
export function Menu({ button, buttonClass, label, side = "bottom", align = "end", stretch, children }: {
  button: React.ReactNode; buttonClass?: string; label: string; side?: "top" | "bottom"; align?: "start" | "end"; stretch?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  function place() {
    const r = btn.current!.getBoundingClientRect();
    const s: React.CSSProperties = {};
    if (side === "bottom") s.top = r.bottom + 6; else s.bottom = window.innerHeight - r.top + 6;
    if (stretch) { s.left = r.left; s.width = r.width; }
    else if (align === "end") s.right = Math.max(8, window.innerWidth - r.right);
    else s.left = Math.max(8, r.left);
    setPos(s);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onMove = (e: Event) => { if (!(e.target instanceof Node && wrap.current?.contains(e.target))) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const r = requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>(".menu .menu-item")?.focus());
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      cancelAnimationFrame(r);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(wrap.current?.querySelectorAll<HTMLElement>(".menu .menu-item") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  }

  return (
    <div className="menu-wrap" ref={wrap}>
      <button ref={btn} type="button" className={buttonClass} aria-haspopup="menu" aria-expanded={open} aria-label={label}
        onClick={() => { if (!open) place(); setOpen((o) => !o); }}>{button}</button>
      {open && <div className={`menu ${side}`} role="menu" style={pos} onKeyDown={onKeyDown}>{children(close)}</div>}
    </div>
  );
}

/* ---------- Thème (système / clair / sombre), mémorisé sur l'appareil ---------- */
export type Theme = "system" | "light" | "dark";
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    try { const t = localStorage.getItem("theme"); if (t === "light" || t === "dark") setThemeState(t); } catch {}
  }, []);
  const setTheme = useCallback((t: Theme) => {
    const apply = () => {
      if (t === "system") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = t;
    };
    setThemeState(t);
    try { if (t === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", t); } catch {}
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(apply);
    else apply();
  }, []);
  return [theme, setTheme] as const;
}

export function ThemeSwitch() {
  const [theme, setTheme] = useTheme();
  return (
    <Segmented<Theme> value={theme} onChange={setTheme} label="Thème" full options={[
      { value: "system", label: <span className="sr-only">Système</span>, icon: <Icon name="monitor" size={15} />, title: "Système" },
      { value: "light", label: <span className="sr-only">Clair</span>, icon: <Icon name="sun" size={15} />, title: "Clair" },
      { value: "dark", label: <span className="sr-only">Sombre</span>, icon: <Icon name="moon" size={15} />, title: "Sombre" },
    ]} />
  );
}
