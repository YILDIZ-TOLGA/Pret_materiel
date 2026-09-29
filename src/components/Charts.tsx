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
 * Graphique temporel minimal (colonnes ou lignes) avec info-bulle au survol.
 * Une seule échelle Y ; pour 2+ séries une légende est affichée.
 */
export function TimeChart({ data, x, series, format = compact, xLabel = (v) => v, height = 200, kind = "bar" }: Props) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 8, t: 10, b: 24 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const max = niceMax(Math.max(0, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const n = data.length || 1;
  const band = iw / n;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const cx = (i: number) => pad.l + band * i + band / 2;
  const ticks = [0, max / 2, max];
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * n);
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const barW = Math.max(2, Math.min(24, (band - 2) / series.length));
  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend" style={{ marginBottom: 8 }}>
          {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
        </div>
      )}
      <svg width={w} height={height} role="img" aria-label={series.map((s) => s.label).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.l - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => i % every === 0 && (
          <text key={i} className="axis" x={cx(i)} y={height - 6} textAnchor="middle">{xLabel(String(d[x]))}</text>
        ))}
        {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeWidth={1} opacity={0.4} />}
        {kind === "bar"
          ? data.map((d, i) => series.map((s, si) => {
              const v = Number(d[s.key]) || 0;
              const h = (v / max) * ih;
              const bx = cx(i) - (barW * series.length) / 2 + si * barW;
              const r = Math.max(0, Math.min(4, h, (barW - 2) / 2));
              if (h <= 0) return null;
              // coin arrondi en haut, carré à la base
              return <path key={`${i}-${s.key}`} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55}
                d={`M${bx},${pad.t + ih} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 - 2 * r} q${r},0 ${r},${r} v${h - r} z`} />;
            }))
          : series.map((s) => (
              <g key={s.key}>
                <path fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  d={data.map((d, i) => `${i ? "L" : "M"}${cx(i)},${y(Number(d[s.key]) || 0)}`).join(" ")} />
                {hover !== null && <circle cx={cx(hover)} cy={y(Number(data[hover]?.[s.key]) || 0)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
              </g>
            ))}
        <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && data[hover] && (
        <div className="tip" style={{ left: Math.min(Math.max(cx(hover), 70), w - 70), top: pad.t + (series.length > 1 ? 28 : 0) }}>
          <div className="muted tiny">{xLabel(String(data[hover][x]))}</div>
          {series.map((s) => (
            <div key={s.key}><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 6 }} />
              {series.length > 1 && `${s.label} : `}<strong>{format(Number(data[hover][s.key]) || 0)}</strong></div>
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
      {rows.map((r) => (
        <div key={r.label} style={{ display: "contents" }} title={`${r.label} : ${format(r.n)}`}>
          <span className="lbl">{r.label}</span><strong className="small">{format(r.n)}</strong>
          <div className="track"><div style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Kpi({ label, value, prev, current, hint, upIsGood = true }: { label: string; value: string; prev?: number; current?: number; hint?: string; upIsGood?: boolean }) {
  let delta: React.ReactNode = hint ? <div className="kpi-delta">{hint}</div> : null;
  if (prev !== undefined && current !== undefined) {
    const raw = prev === 0 ? (current > 0 ? 1 : 0) : (current - prev) / prev;
    const diff = Math.abs(raw) < 0.005 ? 0 : raw;
    const up = diff > 0;
    const cls = diff === 0 ? "" : up === upIsGood ? "up" : "down";
    delta = <div className={`kpi-delta ${cls}`}>{diff === 0 ? "=" : up ? "▲" : "▼"} {prev === 0 && current > 0 ? "nouveau" : `${Math.abs(diff * 100).toFixed(0)} %`} vs période préc.</div>;
  }
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta}
    </div>
  );
}
