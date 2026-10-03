import { headers } from "next/headers";

/**
 * Limitation simple en mémoire (par processus) contre les essais de mots de passe en série.
 * Suffisant pour une instance unique ; derrière plusieurs instances, utiliser Redis.
 */
const hits = new Map<string, number[]>();

export async function rateLimited(scope: string, max: number, windowMs: number) {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return list.length > max;
}
