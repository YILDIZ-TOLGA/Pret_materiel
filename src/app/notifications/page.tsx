"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/components/Providers";
import { api, dateFr } from "@/lib/client";

type N = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

export default function NotificationsPage() {
  return <AppShell><Notifications /></AppShell>;
}

function Notifications() {
  const { refresh } = useMe();
  const [items, setItems] = useState<N[] | null>(null);
  useEffect(() => {
    api("/api/notifications").then((r) => {
      setItems(r.notifications);
      if (r.notifications.some((n: N) => !n.read)) api("/api/notifications", { body: {} }).then(refresh);
    });
  }, [refresh]);

  return (
    <div className="stack">
      <h1 style={{ margin: 0 }}>Alertes</h1>
      {items === null ? <div className="empty">Chargement…</div> : items.length === 0 ? <div className="card empty">Aucune alerte. Tout est en ordre 👌</div> : (
        <div className="list">
          {items.map((n) => {
            const inner = (
              <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <div style={{ flex: 1 }}>
                  <strong>{!n.read && <span className="badge accent" style={{ marginRight: 6 }}>Nouveau</span>}{n.title}</strong>
                  <div className="small" style={{ color: "var(--text-2)" }}>{n.body}</div>
                </div>
                <span className="tiny muted">{dateFr(n.createdAt)}</span>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} style={{ color: "inherit" }}>{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
