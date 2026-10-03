"use client";
import { usePathname } from "next/navigation";
import { isAppRoute } from "@/components/AppShell";

/** Remonté à chaque navigation : fait entrer le contenu des pages de l'application en douceur. */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return isAppRoute(path) ? <div className="page-in">{children}</div> : <>{children}</>;
}
