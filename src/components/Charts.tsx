"use client";
import { useEffect, useRef, useState } from "react";

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const compact = (n: number) => n.toLocaleString("fr-FR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });

type Series = { key: string; label: string; color: string };
type Props = {
  data: Record<string, number | string>[];
  x: string;
  series: Series[];
  format?: (v: number) => string;
  xLabel?: (v: string) => string;
  height?: number;
  kind?: "bar" | "line";
};

/**
 * Graphique temporel (colonnes ou courbes) : les colonnes poussent depuis la base, les courbes se tracent,
 * une bande et une info-bulle suivent le survol. Une seule échelle Y ; légende dès 2 séries.
 */
export function TimeChart({ data, x, series, format = compact, xLabel = (v) => v, height = 200, kind = "bar" }: Props) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const n = data.length || 1;
  const band = iw / n;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const cx = (i: number) => pad.l + band * i + band / 2;
  const ticks = [0, max / 2, max];
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 72)));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const barW = Math.max(2, Math.min(26, (band * 0.72) / series.length));
  const tipY = hover === null ? 0 : Math.min(...series.map((s) => y(Number(data[hover]?.[s.key]) || 0)));
  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend" style={{ marginBottom: 12 }}>
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
      <svg key={`${n}-${String(data[0]?.[x] ?? "")}`} width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {hover !== null && <rect className="band on" x={pad.l + band * hover + 1} y={pad.t} width={Math.max(0, band - 2)} height={ih} rx={4} />}
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text className="axis" x={pad.l - 8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => i % every === 0 && (
          <text key={i} className="axis" x={cx(i)} y={height - 6} textAnchor="middle">{xLabel(String(d[x]))}</text>
        ))}
        {kind === "bar"
          ? data.map((d, i) => series.map((s, si) => {
              const v = Number(d[s.key]) || 0;
              const h = (v / max) * ih;
              const bx = cx(i) - (barW * series.length) / 2 + si * barW;
              const bw = Math.max(1, barW - (series.length > 1 ? 2 : 0));
              const r = Math.max(0, Math.min(4, h, bw / 2));
              if (h <= 0) return null;
              // coins arrondis en haut, base carrée
              return <path key={`${i}-${s.key}`} className="bar" fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45}
                style={{ "--i": i } as React.CSSProperties}
                d={`M${bx},${pad.t + ih} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z`} />;
            }))
          : series.map((s) => (
              <g key={s.key}>
                <path className="line" pathLength={1} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  d={data.map((d, i) => `${i ? "L" : "M"}${cx(i)},${y(Number(d[s.key]) || 0)}`).join(" ")} />
                {hover !== null && <circle cx={cx(hover)} cy={y(Number(data[hover]?.[s.key]) || 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
              </g>
            ))}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && data[hover] && (
        <div className="tip" style={{ left: Math.min(Math.max(cx(hover), 76), w - 76), top: tipY }}>
          <div className="muted tiny">{xLabel(String(data[hover][x]))}</div>
          {series.map((s) => (
            <div key={s.key}><i style={{ background: s.color }} />{series.length > 1 && `${s.label} : `}<strong>{format(Number(data[hover][s.key]) || 0)}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Classement horizontal (top pages, sources, appareils…). */
export function HBars({ rows, format = compact }: { rows: { label: string; n: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <div className="muted small">Pas encore de données.</div>;
  return (
    <div className="hbar">
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "contents" }} title={`${r.label} : ${format(r.n)}`}>
          <span className="lbl">{r.label}</span><strong>{format(r.n)}</strong>
          <div className="track"><div style={{ width: `${(r.n / max) * 100}%`, animationDelay: `${i * 50}ms` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Kpi({ label, value, prev, current, hint, upIsGood = true }: { label: string; value: React.ReactNode; prev?: number; current?: number; hint?: string; upIsGood?: boolean }) {
  let delta: React.ReactNode = hint ? <div className="kpi-delta">{hint}</div> : null;
  if (prev !== undefined && current !== undefined) {
    const raw = prev === 0 ? (current > 0 ? 1 : 0) : (current - prev) / prev;
    const diff = Math.abs(raw) < 0.005 ? 0 : raw;
    const up = diff > 0;
    const cls = diff === 0 ? "" : up === upIsGood ? "up" : "down";
    const text = prev === 0 && current > 0 ? "Nouveau sur la période"
      : diff === 0 ? "Stable vs période précédente"
      : `${up ? "+" : "−"}${Math.abs(diff * 100).toFixed(0)} % vs période précédente`;
    delta = <div className={`kpi-delta ${cls}`}>{text}</div>;
  }
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta}
    </div>
  );
}
