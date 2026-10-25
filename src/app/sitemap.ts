import type { MetadataRoute } from "next";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";

/** sitemap.xml : les pages publiques du site. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${LEGAL.siteUrl}${path}`;
  const legalDate = new Date(TERMS_VERSION);
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/inscription"), changeFrequency: "monthly", priority: 0.8 },
    { url: url("/connexion"), changeFrequency: "yearly", priority: 0.3 },
    ...["/cgu", "/confidentialite", "/mentions-legales", "/cookies"].map((p) => ({
      url: url(p), lastModified: legalDate, changeFrequency: "yearly" as const, priority: 0.2,
    })),
  ];
}
