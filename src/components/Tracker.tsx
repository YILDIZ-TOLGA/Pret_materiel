"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Envoie une page vue à /api/track (analytics maison, affichées dans l'admin). */
export function Tracker() {
  const path = usePathname();
  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem("vid");
      if (!id) { id = crypto.randomUUID(); localStorage.setItem("vid", id); }
    } catch { id = "anon"; }
    const body = JSON.stringify({ path, referrer: document.referrer, visitorId: id });
    fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
