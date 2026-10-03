"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const VID = "vid";
export const NO_TRACK = "no-track";
// Durée de vie max de l'identifiant de mesure d'audience (recommandation CNIL : 13 mois)
const VID_MAX_AGE = 395 * 86400000;

/** L'utilisateur s'est opposé à la mesure d'audience (page Cookies, Do Not Track ou Global Privacy Control). */
export function trackingRefused() {
  try { if (localStorage.getItem(NO_TRACK) === "1") return true; } catch {}
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl === true || nav.doNotTrack === "1";
}

function visitorId() {
  try {
    const [id, ts] = (localStorage.getItem(VID) || "").split(".");
    if (id && Number(ts) && Date.now() - Number(ts) < VID_MAX_AGE) return id;
    const fresh = crypto.randomUUID();
    localStorage.setItem(VID, `${fresh}.${Date.now()}`);
    return fresh;
  } catch {
    return "anon";
  }
}

/**
 * Mesure d'audience maison, exemptée de consentement (délibération CNIL 2020-091) :
 * statistiques anonymes, sans lien avec le compte, sans suivi sur d'autres sites, opposition possible.
 */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    if (trackingRefused()) return;
    const body = JSON.stringify({ path, referrer: document.referrer, visitorId: visitorId() });
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
