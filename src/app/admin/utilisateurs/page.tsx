"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { useMe } from "@/components/Providers";
import { api, dateFr, euros } from "@/lib/client";
import { PLANS } from "@/lib/plans";

type U = { id: string; name: string; email: string; role: string; plan: keyof typeof PLANS; planExpiresAt: string | null; disabled: boolean; createdAt: string; lastLoginAt: string | null; spentCents: number; _count: { loansGiven: number } };

export default function UsersPage() {
  return <AppShell wide admin><Users /></AppShell>;
}

function Users() {
  const { me } = useMe();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: U[]; total: number; pages: number } | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => api(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(setData), [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function patch(u: U, body: object) {
    setMsg("");
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body }); await load(); }
    catch (e) { setMsg((e as Error).message); }
  }
  function setPlan(u: U, plan: string) {
    // Offrir une offre : valable 1 an par défaut
    const exp = plan === "FREE" ? null : new Date(Date.now() + 365 * 86400000).toISOString();
    patch(u, { plan, planExpiresAt: exp });
  }
  async function remove(u: U) {
    if (!confirm(`Supprimer ${u.email} et tous ses prêts ?`)) return;
    try { await api(`/api/admin/users/${u.id}`, { method: "DELETE" }); await load(); } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="stack">
      <AdminNav />
      <input placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      {msg && <div className="alert bad">{msg}</div>}
      {!data ? <div className="empty">Chargement…</div> : <>
        <div className="muted small">{data.total} utilisateur{data.total > 1 ? "s" : ""}</div>
        <div className="card scroll-x" style={{ padding: 8 }}>
          <table className="tbl">
            <thead><tr><th>Utilisateur</th><th>Inscrit</th><th>Dernière connexion</th><th className="num">Prêts</th><th className="num">Payé</th><th>Offre</th><th>Actions</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} style={{ opacity: u.disabled ? 0.5 : 1 }}>
                  <td><strong>{u.name}</strong> {u.role === "ADMIN" && <span className="badge accent">admin</span>} {u.disabled && <span className="badge bad">désactivé</span>}<div className="tiny muted">{u.email}</div></td>
                  <td>{dateFr(u.createdAt)}</td>
                  <td>{u.lastLoginAt ? dateFr(u.lastLoginAt) : "—"}</td>
                  <td className="num">{u._count.loansGiven}</td>
                  <td className="num">{euros(u.spentCents)}</td>
                  <td>
                    <select value={u.plan} onChange={(e) => setPlan(u, e.target.value)} style={{ minHeight: 34, padding: "4px 8px" }}>
                      {Object.values(PLANS).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {u.planExpiresAt && u.plan !== "FREE" && <div className="tiny muted">jusqu&apos;au {dateFr(u.planExpiresAt)}</div>}
                  </td>
                  <td>
                    {u.id !== me?.user.id && <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                      <button className="btn small" onClick={() => patch(u, { disabled: !u.disabled })}>{u.disabled ? "Réactiver" : "Désactiver"}</button>
                      <button className="btn small" onClick={() => patch(u, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>{u.role === "ADMIN" ? "Retirer admin" : "Admin"}</button>
                      <button className="btn small danger" onClick={() => remove(u)}>Suppr.</button>
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.pages > 1 && (
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button>
            <span className="small">{page} / {data.pages}</span>
            <button className="btn small" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>→</button>
          </div>
        )}
      </>}
    </div>
  );
}
