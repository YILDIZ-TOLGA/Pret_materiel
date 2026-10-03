"use client";

/**
 * Client HTTP partagé. Sur le web la session passe par cookie ; dans une appli
 * native (Capacitor / React Native) on stocke le token et on l'envoie en Bearer.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

function token() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

// Pendant la fermeture de la page, les requêtes en attente partent en `keepalive` pour ne pas être coupées.
let unloading = false;
export function markUnloading() { unloading = true; }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token();
  const res = await fetch(API_BASE + path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
    keepalive: unloading,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Erreur", res.status, data.code);
  return data as T;
}

export const DAY = 86400000;
export const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });
export const dateFr = (d: string | Date) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
/** « 12 sept. » */
export const dateShort = (d: string | Date | number) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
/** « mercredi 15 octobre » */
export const dateLong = (d: string | Date | number) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Nombre de jours calendaires entre deux dates (heure locale). */
export const dayDiff = (from: Date, to: Date) => Math.round((startOfDay(to) - startOfDay(from)) / DAY);

export type DueTone = "late" | "soon" | "neutral" | "done";
export type Due = { tone: DueTone; short: string; long: string; days: number };

/** Échéance d'un prêt : « J-3 », « Demain », « +4 j »… (en retard dès que la date de retour est passée, comme côté serveur). */
export function dueInfo(l: { dueAt: string; status: string; kind?: string }): Due {
  const money = l.kind === "MONEY";
  if (l.status === "RETURNED") return { tone: "done", short: money ? "Remboursé" : "Rendu", long: money ? "Prêt remboursé" : "Objet rendu", days: 0 };
  const now = new Date();
  const due = new Date(l.dueAt);
  const d = dayDiff(now, due);
  const verb = money ? "rembourser" : "rendre";
  if (due.getTime() < now.getTime()) {
    const late = Math.max(1, -d);
    return { tone: "late", short: `+${late} j`, long: `En retard de ${late} jour${late > 1 ? "s" : ""}`, days: -late };
  }
  if (d <= 0) return { tone: "soon", short: "Aujourd'hui", long: `À ${verb} aujourd'hui`, days: 0 };
  if (d === 1) return { tone: "soon", short: "Demain", long: `À ${verb} demain`, days: 1 };
  return { tone: d <= 3 ? "soon" : "neutral", short: `J-${d}`, long: `À ${verb} dans ${d} jours`, days: d };
}

/** Ancienne API conservée pour compatibilité. */
export function dueLabel(dueAt: string, status: string, kind?: string) {
  const d = dueInfo({ dueAt, status, kind });
  const tone = d.tone === "late" ? "bad" : d.tone === "soon" ? "warn" : d.tone === "done" ? "good" : "accent";
  return { text: d.long, tone: tone as "bad" | "warn" | "good" | "accent" };
}

/** « à l'instant », « il y a 5 min », « hier », « il y a 3 j », puis la date. */
export function relTime(d: string | Date) {
  const t = new Date(d);
  const s = (Date.now() - t.getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  const days = dayDiff(t, new Date());
  if (days === 0) return `il y a ${Math.floor(s / 3600)} h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return dateShort(t);
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Teinte stable par personne, dans une gamme de tons sourds. */
export function hue(s: string) {
  let h = 0;
  for (const c of s.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [18, 38, 96, 152, 196, 232, 330][h % 7];
}

/** Recherche sans accents ni casse. */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type LoanLike = { kind?: string; item: string; amountCents?: number | null; repaidCents?: number };
export const isMoney = (l: LoanLike) => l.kind === "MONEY" && !!l.amountCents;
export const remainingCents = (l: LoanLike) => (isMoney(l) ? Math.max(0, l.amountCents! - (l.repaidCents ?? 0)) : 0);
/** Titre affiché : « Perceuse » ou « 50 € · resto » */
export function loanTitle(l: LoanLike) {
  if (!isMoney(l)) return l.item;
  return l.item && l.item !== "Prêt d'argent" ? `${euros(l.amountCents!)} · ${l.item}` : euros(l.amountCents!);
}
/** Motif d'un prêt d'argent, s'il y en a un. */
export const moneyReason = (l: LoanLike) => (isMoney(l) && l.item && l.item !== "Prêt d'argent" ? l.item : "");
