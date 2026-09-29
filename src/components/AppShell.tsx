"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "./Providers";

const TABS = [
  { href: "/prets", label: "Mes prêts", ico: "📦" },
  { href: "/bilan", label: "Bilan", ico: "📊" },
  { href: "/emprunts", label: "Emprunts", ico: "🤝" },
  { href: "/notifications", label: "Alertes", ico: "🔔" },
  { href: "/abonnement", label: "Offre", ico: "⭐" },
];

export function AppShell({ children, wide, admin }: { children: React.ReactNode; wide?: boolean; admin?: boolean }) {
  const { me, loading, logout } = useMe();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace(`/connexion?next=${encodeURIComponent(path)}`);
    if (!loading && me && admin && me.user.role !== "ADMIN") router.replace("/prets");
  }, [loading, me, admin, path, router]);

  if (loading || !me || (admin && me.user.role !== "ADMIN")) return <div className="container muted center">Chargement…</div>;

  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/prets" className="brand"><span className="brand-dot">P</span>Prêt Matériel</Link>
          <nav className="topnav">
            {TABS.map((t) => (
              <Link key={t.href} href={t.href} className={`desk ${active(t.href) ? "active" : ""}`}>
                {t.label}{t.href === "/notifications" && me.unread > 0 && <span className="pill-count">{me.unread}</span>}
              </Link>
            ))}
            {me.user.role === "ADMIN" && <Link href="/admin" className={active("/admin") ? "active" : ""}>Admin</Link>}
            <button className="btn small" onClick={logout} title={me.user.email}>Déconnexion</button>
          </nav>
        </div>
      </header>
      <main className={`container ${wide ? "wide" : ""}`}>{children}</main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={active(t.href) ? "active" : ""}>
            <span className="ico">{t.ico}</span>{t.label}
            {t.href === "/notifications" && me.unread > 0 && <span className="dot-unread">{me.unread}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}
