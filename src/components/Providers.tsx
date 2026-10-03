"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/client";

export type Me = {
  user: { id: string; name: string; email: string; role: "USER" | "ADMIN"; plan: string; planExpiresAt: string | null; stripeSubscriptionId: string | null; cancelAtPeriodEnd: boolean; createdAt: string; termsAcceptedAt: string | null;
    /** null tant que l'adresse n'a pas été confirmée par le lien reçu par e-mail */
    emailVerifiedAt: string | null; pendingEmail: string | null };
  plan: { id: string; name: string; maxLoans: number; priceLabel: string };
  activeLoans: number;
  /** Prêts en cours dont la date de retour est passée. */
  overdueLoans?: number;
  unread: number;
};

type Ctx = { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const MeContext = createContext<Ctx>({ me: null, loading: true, refresh: async () => {}, logout: async () => {} });

export function Providers({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { setMe(await api<Me>("/api/auth/me")); } catch { setMe(null); }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    try { localStorage.removeItem("token"); } catch {}
    setMe(null);
    location.href = "/";
  }, []);

  useEffect(() => {
    refresh();
    // Rafraîchit le compteur de notifications régulièrement
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return <MeContext.Provider value={{ me, loading, refresh, logout }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
