"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/AdminNav";
import { HBars, Kpi, TimeChart } from "@/components/Charts";
import { api, dateFr, euros } from "@/lib/client";
import { PLANS } from "@/lib/plans";

const RANGES = [7, 30, 90, 365];
const pct = (v: number) => `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const nb = (v: number) => v.toLocaleString("fr-FR");
const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

type Stats = any;

export default function AdminPage() {
  return <AppShell wide admin><Dashboard /></AppShell>;
}

function Dashboard() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<"overview" | "revenue" | "traffic" | "loans">("overview");
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { setS(null); api(`/api/admin/stats?days=${days}`).then(setS).catch((e) => setErr(e.message)); }, [days]);

  const k = s?.kpis;
  return (
    <div className="stack">
      <AdminNav />
      <div className="row">
        <div className="tabs" style={{ flex: "1 1 360px" }}>
          {([["overview", "Vue d'ensemble"], ["revenue", "Revenus"], ["traffic", "Trafic"], ["loans", "Prêts"]] as const).map(([id, l]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: "auto" }} aria-label="Période">
          {RANGES.map((d) => <option key={d} value={d}>{d === 365 ? "12 derniers mois" : `${d} derniers jours`}</option>)}
        </select>
      </div>
      {err && <div className="alert bad">{err}</div>}
      {!s ? <div className="empty">Chargement…</div> : <>
        {tab === "overview" && <>
          <div className="card">
            <div className="kpi-label">Encaissé ce mois-ci</div>
            <div className="hero">{euros(k.revenueMonth)}</div>
            <div className="small muted">Mois dernier : {euros(k.revenueLastMonth)} · Total depuis le début : {euros(k.revenueTotal)}</div>
          </div>
          <div className="grid grid-kpi">
            <Kpi label="MRR (revenu mensuel récurrent)" value={euros(k.mrrCents)} hint={`ARR : ${euros(k.arrCents)}`} />
            <Kpi label="Abonnés payants" value={nb(k.paying)} hint={`Conversion : ${pct(k.conversion)}`} />
            <Kpi label="Visiteurs uniques" value={nb(k.visitors)} current={k.visitors} prev={k.visitorsPrev} />
            <Kpi label="Nouveaux inscrits" value={nb(k.usersNew)} current={k.usersNew} prev={k.usersNewPrev} />
            <Kpi label="Utilisateurs" value={nb(k.usersTotal)} hint={`${nb(k.usersActive)} actifs (30 j)`} />
            <Kpi label="Prêts en cours" value={nb(k.loansActive)} hint={`${nb(k.loansOverdue)} en retard`} />
          </div>
          <div className="grid grid-2">
            <div className="card"><h2>Revenus par mois</h2><TimeChart data={s.monthly} x="month" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={monthLabel} /></div>
            <div className="card"><h2>Visites</h2><TimeChart kind="line" data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "views", label: "Pages vues", color: "var(--series-1)" }, { key: "visitors", label: "Visiteurs", color: "var(--series-2)" }]} /></div>
          </div>
        </>}

        {tab === "revenue" && <>
          <div className="grid grid-kpi">
            <Kpi label={`Encaissé (${days} j)`} value={euros(k.revenueRange)} current={k.revenueRange} prev={k.revenueRangePrev} />
            <Kpi label="Ce mois-ci" value={euros(k.revenueMonth)} current={k.revenueMonth} prev={k.revenueLastMonth} />
            <Kpi label="MRR" value={euros(k.mrrCents)} hint={`ARR : ${euros(k.arrCents)}`} />
            <Kpi label="Total encaissé" value={euros(k.revenueTotal)} hint={`${nb(k.paymentsTotal)} paiements`} />
            <Kpi label="Revenu moyen / utilisateur" value={euros(k.arpuCents)} />
            <Kpi label="Taux de conversion" value={pct(k.conversion)} hint={`${nb(k.paying)} payants / ${nb(k.usersTotal)}`} />
          </div>
          <div className="card"><h2>Revenus des 12 derniers mois</h2><TimeChart data={s.monthly} x="month" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={monthLabel} height={240} /></div>
          <div className="card"><h2>Revenus par jour ({days} j)</h2><TimeChart data={s.daily} x="day" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={dayLabel} /></div>
          <div className="grid grid-2">
            <div className="card">
              <h2>Abonnés actifs par offre</h2>
              <HBars rows={(["MONTHLY", "YEARLY_10", "YEARLY_20"] as const).map((p) => ({ label: `${PLANS[p].name} (${PLANS[p].priceLabel})`, n: k.subs[p] ?? 0 }))} />
            </div>
            <div className="card">
              <h2>Revenus par offre ({days} j)</h2>
              <HBars rows={s.revenueByPlan.map((r: any) => ({ label: PLANS[r.plan as keyof typeof PLANS].name, n: r.cents }))} format={(v) => euros(v)} />
            </div>
          </div>
          <div className="card scroll-x">
            <h2>Derniers paiements</h2>
            {s.recentPayments.length === 0 ? <div className="muted small">Aucun paiement.</div> : (
              <table className="tbl"><thead><tr><th>Date</th><th>Client</th><th>Offre</th><th>Via</th><th className="num">Montant</th></tr></thead>
                <tbody>{s.recentPayments.map((p: any) => (
                  <tr key={p.id}><td>{dateFr(p.createdAt)}</td><td>{p.user?.email ?? "—"}</td><td>{PLANS[p.plan as keyof typeof PLANS].name}</td><td>{p.provider}</td><td className="num">{euros(p.amountCents)}</td></tr>
                ))}</tbody></table>
            )}
          </div>
        </>}

        {tab === "traffic" && <>
          <div className="grid grid-kpi">
            <Kpi label="Pages vues" value={nb(k.views)} current={k.views} prev={k.viewsPrev} />
            <Kpi label="Visiteurs uniques" value={nb(k.visitors)} current={k.visitors} prev={k.visitorsPrev} />
            <Kpi label="Pages / visiteur" value={k.viewsPerVisitor.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} />
            <Kpi label="Visiteur → inscrit" value={pct(k.signupRate)} hint={`${nb(k.usersNew)} inscriptions`} />
          </div>
          <div className="card"><h2>Visites par jour</h2><TimeChart kind="line" data={s.daily} x="day" xLabel={dayLabel} height={240} series={[{ key: "views", label: "Pages vues", color: "var(--series-1)" }, { key: "visitors", label: "Visiteurs", color: "var(--series-2)" }]} /></div>
          <div className="card"><h2>Inscriptions par jour</h2><TimeChart data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "signups", label: "Inscriptions", color: "var(--series-1)" }]} /></div>
          <div className="grid grid-2">
            <div className="card"><h2>Pages les plus vues</h2><HBars rows={s.traffic.pages} /></div>
            <div className="card"><h2>Sources de trafic</h2><HBars rows={s.traffic.referrers} /></div>
            <div className="card"><h2>Appareils</h2><HBars rows={s.traffic.devices} /></div>
            <div className="card"><h2>Navigateurs</h2><HBars rows={s.traffic.browsers} /></div>
            <div className="card"><h2>Pays</h2><HBars rows={s.traffic.countries} /><p className="tiny muted" style={{ margin: "8px 0 0" }}>Renseigné derrière Cloudflare ou Vercel.</p></div>
          </div>
        </>}

        {tab === "loans" && <>
          <div className="grid grid-kpi">
            <Kpi label="Prêts créés au total" value={nb(k.loansTotal)} hint={`${nb(k.loansNew)} sur ${days} j`} />
            <Kpi label="En cours" value={nb(k.loansActive)} />
            <Kpi label="En retard" value={nb(k.loansOverdue)} hint={k.loansActive ? `${pct(k.loansOverdue / k.loansActive)} des prêts en cours` : undefined} />
            <Kpi label="Rendus" value={nb(k.loansReturned)} />
            <Kpi label="Durée moyenne d'un prêt" value={k.avgLoanDays == null ? "—" : `${k.avgLoanDays.toFixed(1)} j`} />
            <Kpi label="Rendus en retard" value={k.lateReturnRate == null ? "—" : pct(k.lateReturnRate)} />
            <Kpi label="Prêts d'argent" value={nb(k.moneyLoans)} hint={`${euros(k.moneyLentCents)} prêtés · ${euros(k.moneyRepaidCents)} remboursés`} />
            <Kpi label={`E-mails envoyés (${days} j)`} value={nb(k.emailsOk)} hint={k.emailsFail ? `⚠ ${nb(k.emailsFail)} échecs` : "0 échec"} />
          </div>
          <div className="card"><h2>Prêts créés par jour</h2><TimeChart data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "loans", label: "Prêts", color: "var(--series-1)" }]} /></div>
          <div className="card scroll-x">
            <h2>Derniers inscrits</h2>
            <table className="tbl"><thead><tr><th>Date</th><th>Nom</th><th>E-mail</th><th>Offre</th></tr></thead>
              <tbody>{s.recentUsers.map((u: any) => <tr key={u.id}><td>{dateFr(u.createdAt)}</td><td>{u.name}</td><td>{u.email}</td><td>{PLANS[u.plan as keyof typeof PLANS].name}</td></tr>)}</tbody></table>
          </div>
        </>}
      </>}
    </div>
  );
}
