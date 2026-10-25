"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { api, dateFr } from "@/lib/client";

export type SiteInfo = { mode: "BETA" | "PAID"; paidFrom: string | null; betaLimits: { maxLoans: number; maxNewLoansPerDay: number } };

// Une seule requête par chargement de page, partagée par tous les composants qui en ont besoin
let pending: Promise<SiteInfo | null> | null = null;

/** Mode du site pour les pages publiques (connecté ou non) : phase de test gratuite ou offres payantes. */
export function useSite() {
  const [site, setSite] = useState<SiteInfo | null>(null);
  useEffect(() => {
    pending ??= api<SiteInfo>("/api/site").catch(() => null);
    pending.then(setSite);
  }, []);
  return site;
}

/** Bandeau de l'espace connecté quand le passage au mode payant est programmé. */
export function PaidSwitchBanner({ paidFrom }: { paidFrom: string }) {
  return (
    <div className="banner soon" role="status" style={{ marginBottom: 20 }}>
      <Icon name="info" size={16} />
      <span>
        Le site passe en mode payant le <strong>{dateFr(paidFrom)}</strong>. Rien ne sera supprimé : tes prêts restent consultables et modifiables.{" "}
        <Link href="/abonnement">Ce qui change</Link>
      </span>
    </div>
  );
}
