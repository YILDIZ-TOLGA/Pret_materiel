import { headers } from "next/headers";

/**
 * Limitation simple en mémoire (par processus) contre les essais de mots de passe en série.
 * Suffisant pour une instance unique ; derrière plusieurs instances, utiliser Redis.
 */
const hits = new Map<string, number[]>();

/**
 * Adresse IP du visiteur. Le client peut écrire ce qu'il veut au début de X-Forwarded-For : on prend la
 * dernière valeur, ajoutée par le reverse proxy (Caddy, nginx) juste devant le site. CF-Connecting-IP
 * n'est lu que si le site est derrière Cloudflare (BEHIND_CLOUDFLARE=true), sinon il serait falsifiable.
 */
async function clientIp() {
  const h = await headers();
  if (process.env.BEHIND_CLOUDFLARE === "true" && h.get("cf-connecting-ip")) return h.get("cf-connecting-ip")!;
  const chain = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return chain?.at(-1) || h.get("x-real-ip") || "local";
}

/** Par défaut la limite s'applique à l'adresse IP ; `id` permet de la poser sur autre chose (compte, adresse e-mail). */
export async function rateLimited(scope: string, max: number, windowMs: number, id?: string) {
  const ip = id ?? (await clientIp());
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
  return list.length > max;
}
