"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { EmptyState, PageHeader, SkeletonRows } from "@/components/ui";
import { api, dayDiff, relTime } from "@/lib/client";

type N = { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };

/** Icône et ton d'une alerte, d'après son titre (« Prêt en retard », « Remboursement enregistré »…). */
function look(title: string): { icon: IconName; tone: string } {
  const t = title.toLowerCase();
  if (t.includes("retard")) return { icon: "alert", tone: "late" };
  if (t.includes("rembours")) return { icon: "banknote", tone: "ok" };
  if (t.includes("clôtur") || t.includes("rendu")) return { icon: "check", tone: "ok" };
  if (t.includes("demain") || t.includes("échéance")) return { icon: "clock", tone: "soon" };
  if (t.includes("emprunt")) return { icon: "inbox", tone: "" };
  return { icon: "bell", tone: "" };
}

function bucket(d: string) {
  const days = dayDiff(new Date(d), new Date());
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return "Cette semaine";
  if (days < 31) return "Ce mois-ci";
  return "Plus ancien";
}

export default function NotificationsPage() {
  const { refresh } = useMe();
  const [items, setItems] = useState<N[] | null>(null);
  useEffect(() => {
    api("/api/notifications").then((r) => {
      setItems(r.notifications);
      if (r.notifications.some((n: N) => !n.read)) api("/api/notifications", { body: {} }).then(refresh).catch(() => {});
    }).catch(() => setItems([]));
  }, [refresh]);

  const groups: [string, N[]][] = [];
  for (const n of items ?? []) {
    const b = bucket(n.createdAt);
    const g = groups.find(([k]) => k === b);
    if (g) g[1].push(n); else groups.push([b, [n]]);
  }

  let i = 0;
  return (
    <>
      <PageHeader title="Alertes" sub="Retards, remboursements et nouveaux emprunts." />
      {items === null ? <SkeletonRows n={4} /> : items.length === 0 ? (
        <div className="card flush"><EmptyState title="Rien à signaler">Tu seras prévenu ici dès qu&apos;un prêt dépasse sa date de retour.</EmptyState></div>
      ) : groups.map(([label, list]) => (
        <section key={label} className="notif-group">
          <h2 className="section-label">{label}<span className="n">{list.length}</span></h2>
          <div className="lrows">
            {list.map((n) => {
              const l = look(n.title);
              const inner = (
                <>
                  <span className={`notif-ico ${l.tone}`}><Icon name={l.icon} size={17} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-body">{n.body}</div>
                  </div>
                  <time className="notif-time" dateTime={n.createdAt}>{relTime(n.createdAt)}</time>
                </>
              );
              const cls = `notif ${n.read ? "" : "unread"}`;
              const style = { "--i": Math.min(i++, 12) } as React.CSSProperties;
              return n.link
                ? <Link key={n.id} href={n.link} className={cls} style={style}>{inner}</Link>
                : <div key={n.id} className={cls} style={style}>{inner}</div>;
            })}
          </div>
        </section>
      ))}
    </>
  );
}
