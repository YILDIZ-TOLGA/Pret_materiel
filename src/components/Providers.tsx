"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, isNativeApp, saveAuthToken } from "@/lib/client";

export type Me = {
  user: { id: string; name: string; organization: string | null; email: string; role: "USER" | "ADMIN"; plan: string; planExpiresAt: string | null; stripeSubscriptionId: string | null; cancelAtPeriodEnd: boolean; createdAt: string; termsAcceptedAt: string | null;
    /** null tant que l'adresse n'a pas été confirmée par le lien reçu par e-mail */
    emailVerifiedAt: string | null; pendingEmail: string | null };
  plan: { id: string; name: string; maxLoans: number; priceLabel: string };
  activeLoans: number;
  /** Prêts en cours dont la date de retour est passée. */
  overdueLoans?: number;
  unread: number;
  /** Mode du site : phase de test (tout gratuit) ou payant, et passage au payant programmé. */
  site?: { mode: "BETA" | "PAID"; paidFrom: string | null };
  /** Date limite pour se rétracter de l'abonnement en cours, ou null si ce n'est plus possible. */
  withdrawalUntil?: string | null;
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
    saveAuthToken(null);
    setMe(null);
    location.href = "/";
  }, []);

  useEffect(() => {
    // Ancienne version : le site gardait aussi le jeton en localStorage. On l'efface (le cookie suffit).
    if (!isNativeApp()) saveAuthToken(null);
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
