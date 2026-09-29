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

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token();
  const res = await fetch(API_BASE + path, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || "Erreur", res.status, data.code);
  return data as T;
}

export const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 });
export const dateFr = (d: string | Date) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export function dueLabel(dueAt: string, status: string) {
  if (status === "RETURNED") return { text: "Rendu", tone: "good" as const };
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (new Date(dueAt).getTime() < Date.now()) {
    const late = Math.max(1, -days);
    return { text: `En retard de ${late} j`, tone: "bad" as const };
  }
  if (days <= 1) return { text: days <= 0 ? "Aujourd'hui" : "Demain", tone: "warn" as const };
  return { text: `Dans ${days} j`, tone: "accent" as const };
}

export function itemEmoji(item: string) {
  const s = item.toLowerCase();
  const map: [RegExp, string][] = [
    [/livre|bd|manga|roman/, "📚"], [/perceuse|visseuse|outil|marteau|scie|cl[eé]/, "🛠️"], [/v[ée]lo/, "🚲"],
    [/jeu|console|switch|ps5|xbox|manette/, "🎮"], [/cam[eé]ra|appareil|photo|objectif/, "📷"], [/ordi|pc|laptop|macbook|[ée]cran/, "💻"],
    [/tente|camping|sac/, "🎒"], [/voiture|remorque/, "🚗"], [/enceinte|casque|audio|micro/, "🎧"], [/[ée]chelle/, "🪜"],
    [/t[ée]l[ée]phone|iphone|chargeur|c[aâ]ble/, "🔌"], [/film|dvd|blu/, "🎬"], [/vaisselle|plat|appareil [àa] raclette|cuisine|robot/, "🍳"],
  ];
  return map.find(([r]) => r.test(s))?.[1] ?? "📦";
}
