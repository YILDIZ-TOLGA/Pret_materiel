"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useConfirm } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { useToast } from "@/components/Toast";
import { Avatar, Menu, SkeletonRows } from "@/components/ui";
import { api, dateFr, euros } from "@/lib/client";
import { PLANS } from "@/lib/plans";

type U = { id: string; name: string; email: string; role: string; plan: keyof typeof PLANS; planExpiresAt: string | null; disabled: boolean; createdAt: string; lastLoginAt: string | null; spentCents: number; _count: { loansGiven: number } };

export default function UsersPage() {
  const { me } = useMe();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: U[]; total: number; pages: number } | null>(null);

  const load = useCallback(() => api(`/api/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(setData), [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function patch(u: U, body: object, done?: string) {
    try { await api(`/api/admin/users/${u.id}`, { method: "PATCH", body }); await load(); if (done) toast.show({ text: done }); }
    catch (e) { toast.show({ tone: "error", text: (e as Error).message }); }
  }
  function setPlan(u: U, plan: string) {
    // Offrir une offre : valable 1 an par défaut
    const exp = plan === "FREE" ? null : new Date(Date.now() + 365 * 86400000).toISOString();
    patch(u, { plan, planExpiresAt: exp }, `Offre de ${u.name} : ${PLANS[plan as keyof typeof PLANS].name}`);
  }
  async function remove(u: U) {
    const ok = await confirm({ title: `Supprimer ${u.name} ?`, body: <>Le compte {u.email} et tous ses prêts seront supprimés définitivement.</>, confirmLabel: "Supprimer", danger: true, icon: "trash" });
    if (!ok) return;
    try { await api(`/api/admin/users/${u.id}`, { method: "DELETE" }); await load(); toast.show({ text: "Compte supprimé" }); }
    catch (e) { toast.show({ tone: "error", text: (e as Error).message }); }
  }

  return (
    <>
      <AdminNav />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <label className="search" style={{ width: 320, maxWidth: "100%" }}>
          <span className="sr-only">Rechercher un utilisateur</span>
          <Icon name="search" size={15} />
          <input data-page-search placeholder="Rechercher par nom ou e-mail…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <kbd>/</kbd>
        </label>
        {data && <span className="small muted mono">{data.total} utilisateur{data.total > 1 ? "s" : ""}</span>}
      </div>
      {!data ? <SkeletonRows n={5} /> : (
        <>
          <section className="card flush table-card">
            <table className="tbl">
              <thead><tr><th>Utilisateur</th><th>Inscrit</th><th>Dernière connexion</th><th className="num">Prêts</th><th className="num">Payé</th><th>Offre</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} style={{ opacity: u.disabled ? 0.55 : 1 }}>
                    <td>
                      <div className="user-cell">
                        <Avatar name={u.name} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <b>{u.name}{u.role === "ADMIN" && <span className="tag brand">Admin</span>}{u.disabled && <span className="tag late">Désactivé</span>}</b>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono nowrap small">{dateFr(u.createdAt)}</td>
                    <td className="mono nowrap small">{u.lastLoginAt ? dateFr(u.lastLoginAt) : "—"}</td>
                    <td className="num">{u._count.loansGiven}</td>
                    <td className="num">{euros(u.spentCents)}</td>
                    <td>
                      <select className="small" value={u.plan} onChange={(e) => setPlan(u, e.target.value)} aria-label={`Offre de ${u.name}`}>
                        {Object.values(PLANS).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {u.planExpiresAt && u.plan !== "FREE" && <div className="tiny muted" style={{ marginTop: 4 }}>jusqu&apos;au {dateFr(u.planExpiresAt)}</div>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {u.id !== me?.user.id && (
                        <Menu label={`Actions pour ${u.name}`} buttonClass="icon-btn" button={<Icon name="more" size={18} />}>
                          {(close) => (
                            <>
                              <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); patch(u, { disabled: !u.disabled }, u.disabled ? "Compte réactivé" : "Compte désactivé"); }}>
                                <Icon name={u.disabled ? "refresh" : "lock"} size={16} />{u.disabled ? "Réactiver le compte" : "Désactiver le compte"}
                              </button>
                              <button type="button" role="menuitem" className="menu-item" onClick={() => { close(); patch(u, { role: u.role === "ADMIN" ? "USER" : "ADMIN" }, u.role === "ADMIN" ? "Droits d'administration retirés" : "Droits d'administration accordés"); }}>
                                <Icon name="shield" size={16} />{u.role === "ADMIN" ? "Retirer les droits admin" : "Donner les droits admin"}
                              </button>
                              <div className="menu-sep" />
                              <button type="button" role="menuitem" className="menu-item danger" onClick={() => { close(); remove(u); }}><Icon name="trash" size={16} />Supprimer le compte</button>
                            </>
                          )}
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {data.pages > 1 && (
            <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
              <button type="button" className="btn small icon" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente"><Icon name="chevronLeft" size={16} /></button>
              <span className="small mono">{page} / {data.pages}</span>
              <button type="button" className="btn small icon" disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Page suivante"><Icon name="chevronRight" size={16} /></button>
            </div>
          )}
        </>
      )}
    </>
  );
}
