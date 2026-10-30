import type { MetadataRoute } from "next";
import { LEGAL } from "@/lib/legal";

/** robots.txt : seules les pages publiques sont à indexer, jamais l'espace connecté ni l'API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin", "/prets", "/bilan", "/emprunts", "/notifications", "/abonnement", "/compte",
        // pages ouvertes par un lien personnel reçu par e-mail
        "/desinscription", "/verifier-email", "/reinitialiser-mot-de-passe", "/signer",
      ],
    },
    sitemap: `${LEGAL.siteUrl}/sitemap.xml`,
  };
}
