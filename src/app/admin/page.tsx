"use client";
import { useEffect, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { HBars, Kpi, TimeChart } from "@/components/Charts";
import { Icon } from "@/components/Icon";
import { CountUp, Segmented, SkeletonRows } from "@/components/ui";
import { api, dateFr, euros } from "@/lib/client";
import { PLANS } from "@/lib/plans";

const RANGES = [7, 30, 90, 365];
const pct = (v: number) => `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
const nb = (v: number) => v.toLocaleString("fr-FR");
const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const monthLabel = (m: string) => new Date(m + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
const eurosTo = (target: number) => (n: number) => euros(Math.abs(n - target) < 0.5 ? target : Math.round(n / 100) * 100);
type Tab = "overview" | "revenue" | "traffic" | "loans";

type Stats = any;

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="card flush">
      <div className="card-head"><h2>{title}</h2>{note && <span className="tiny muted mono">{note}</span>}</div>
      <div className="card-body">{children}</div>
    </section>
  );
}

export default function AdminPage() {
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<Tab>("overview");
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => { setS(null); api(`/api/admin/stats?days=${days}`).then(setS).catch((e) => setErr(e.message)); }, [days]);

  const k = s?.kpis;
  return (
    <>
      <AdminNav />
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <Segmented<Tab> value={tab} onChange={setTab} label="Vue" options={[
          { value: "overview", label: "Vue d'ensemble" }, { value: "revenue", label: "Revenus" }, { value: "traffic", label: "Trafic" }, { value: "loans", label: "Prêts" },
        ]} />
        <select className="small" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Période">
          {RANGES.map((d) => <option key={d} value={d}>{d === 365 ? "12 derniers mois" : `${d} derniers jours`}</option>)}
        </select>
      </div>
      {err && <div className="banner late" style={{ marginBottom: 16 }}><Icon name="alert" size={16} />{err}</div>}
      {!s ? <SkeletonRows n={4} /> : (
        <div className="stack page-in" key={`${tab}-${days}`}>
          {tab === "overview" && <>
            <section className="stats">
              <div className="stat">
                <div className="stat-label">Encaissé ce mois-ci</div>
                <div className="stat-value"><CountUp value={k.revenueMonth} format={eurosTo(k.revenueMonth)} /></div>
                <div className="stat-sub">Mois dernier : {euros(k.revenueLastMonth)} · Total : {euros(k.revenueTotal)}</div>
              </div>
              <div className="stat">
                <div className="stat-label">Revenu mensuel récurrent</div>
                <div className="stat-value"><CountUp value={k.mrrCents} format={eurosTo(k.mrrCents)} /></div>
                <div className="stat-sub">ARR : {euros(k.arrCents)} · {nb(k.paying)} abonnés payants</div>
              </div>
            </section>
            <section className="stats kpis">
              <Kpi label="Visiteurs uniques" value={nb(k.visitors)} current={k.visitors} prev={k.visitorsPrev} />
              <Kpi label="Nouveaux inscrits" value={nb(k.usersNew)} current={k.usersNew} prev={k.usersNewPrev} />
              <Kpi label="Utilisateurs" value={nb(k.usersTotal)} hint={`${nb(k.usersActive)} actifs (30 j)`} />
              <Kpi label="Conversion" value={pct(k.conversion)} hint={`${nb(k.paying)} payants`} />
              <Kpi label="Prêts en cours" value={nb(k.loansActive)} hint={`${nb(k.loansOverdue)} en retard`} />
            </section>
            <div className="grid grid-2">
              <ChartCard title="Revenus par mois"><TimeChart data={s.monthly} x="month" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={monthLabel} /></ChartCard>
              <ChartCard title="Visites"><TimeChart kind="line" data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "views", label: "Pages vues", color: "var(--series-1)" }, { key: "visitors", label: "Visiteurs", color: "var(--series-2)" }]} /></ChartCard>
            </div>
          </>}

          {tab === "revenue" && <>
            <section className="stats kpis">
              <Kpi label={`Encaissé (${days} j)`} value={euros(k.revenueRange)} current={k.revenueRange} prev={k.revenueRangePrev} />
              <Kpi label="Ce mois-ci" value={euros(k.revenueMonth)} current={k.revenueMonth} prev={k.revenueLastMonth} />
              <Kpi label="MRR" value={euros(k.mrrCents)} hint={`ARR : ${euros(k.arrCents)}`} />
              <Kpi label="Total encaissé" value={euros(k.revenueTotal)} hint={`${nb(k.paymentsTotal)} paiements`} />
              <Kpi label="Revenu moyen / utilisateur" value={euros(k.arpuCents)} />
              <Kpi label="Taux de conversion" value={pct(k.conversion)} hint={`${nb(k.paying)} payants / ${nb(k.usersTotal)}`} />
            </section>
            <ChartCard title="Revenus des 12 derniers mois"><TimeChart data={s.monthly} x="month" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={monthLabel} height={240} /></ChartCard>
            <ChartCard title="Revenus par jour" note={`${days} j`}><TimeChart data={s.daily} x="day" series={[{ key: "revenue", label: "Revenus", color: "var(--series-1)" }]} format={(v) => euros(v)} xLabel={dayLabel} /></ChartCard>
            <div className="grid grid-2">
              <ChartCard title="Abonnés actifs par offre">
                <HBars rows={(["MONTHLY", "YEARLY_10", "YEARLY_20"] as const).map((p) => ({ label: `${PLANS[p].name} (${PLANS[p].priceLabel})`, n: k.subs[p] ?? 0 }))} />
              </ChartCard>
              <ChartCard title="Revenus par offre" note={`${days} j`}>
                <HBars rows={s.revenueByPlan.map((r: any) => ({ label: PLANS[r.plan as keyof typeof PLANS].name, n: r.cents }))} format={(v) => euros(v)} />
              </ChartCard>
            </div>
            <section className="card flush">
              <div className="card-head"><h2>Derniers paiements</h2></div>
              {s.recentPayments.length === 0 ? <p className="muted small" style={{ padding: 20, margin: 0 }}>Aucun paiement.</p> : (
                <div className="table-card">
                  <table className="tbl"><thead><tr><th>Date</th><th>Client</th><th>Offre</th><th>Via</th><th className="num">Montant</th></tr></thead>
                    <tbody>{s.recentPayments.map((p: any) => (
                      <tr key={p.id}><td className="mono nowrap">{dateFr(p.createdAt)}</td><td>{p.user?.email ?? "—"}</td><td>{PLANS[p.plan as keyof typeof PLANS].name}</td><td>{p.provider}</td><td className="num">{euros(p.amountCents)}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </section>
          </>}

          {tab === "traffic" && <>
            <section className="stats kpis">
              <Kpi label="Pages vues" value={nb(k.views)} current={k.views} prev={k.viewsPrev} />
              <Kpi label="Visiteurs uniques" value={nb(k.visitors)} current={k.visitors} prev={k.visitorsPrev} />
              <Kpi label="Pages / visiteur" value={k.viewsPerVisitor.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} />
              <Kpi label="Taux d'inscription" value={pct(k.signupRate)} hint={`${nb(k.usersNew)} inscriptions`} />
            </section>
            <ChartCard title="Visites par jour"><TimeChart kind="line" data={s.daily} x="day" xLabel={dayLabel} height={240} series={[{ key: "views", label: "Pages vues", color: "var(--series-1)" }, { key: "visitors", label: "Visiteurs", color: "var(--series-2)" }]} /></ChartCard>
            <ChartCard title="Inscriptions par jour"><TimeChart data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "signups", label: "Inscriptions", color: "var(--series-1)" }]} /></ChartCard>
            <div className="grid grid-2">
              <ChartCard title="Pages les plus vues"><HBars rows={s.traffic.pages} /></ChartCard>
              <ChartCard title="Sources de trafic"><HBars rows={s.traffic.referrers} /></ChartCard>
              <ChartCard title="Appareils"><HBars rows={s.traffic.devices} /></ChartCard>
              <ChartCard title="Navigateurs"><HBars rows={s.traffic.browsers} /></ChartCard>
              <ChartCard title="Pays" note="derrière Cloudflare ou Vercel"><HBars rows={s.traffic.countries} /></ChartCard>
            </div>
          </>}

          {tab === "loans" && <>
            <section className="stats kpis">
              <Kpi label="Prêts créés au total" value={nb(k.loansTotal)} hint={`${nb(k.loansNew)} sur ${days} j`} />
              <Kpi label="En cours" value={nb(k.loansActive)} />
              <Kpi label="En retard" value={nb(k.loansOverdue)} hint={k.loansActive ? `${pct(k.loansOverdue / k.loansActive)} des prêts en cours` : undefined} />
              <Kpi label="Rendus" value={nb(k.loansReturned)} />
              <Kpi label="Durée moyenne d'un prêt" value={k.avgLoanDays == null ? "—" : `${k.avgLoanDays.toFixed(1)} j`} />
              <Kpi label="Rendus en retard" value={k.lateReturnRate == null ? "—" : pct(k.lateReturnRate)} />
              <Kpi label="Prêts d'argent" value={nb(k.moneyLoans)} hint={`${euros(k.moneyLentCents)} prêtés · ${euros(k.moneyRepaidCents)} remboursés`} />
              <Kpi label={`E-mails envoyés (${days} j)`} value={nb(k.emailsOk)} hint={k.emailsFail ? `${nb(k.emailsFail)} échec${k.emailsFail > 1 ? "s" : ""}` : "Aucun échec"} />
            </section>
            <ChartCard title="Prêts créés par jour"><TimeChart data={s.daily} x="day" xLabel={dayLabel} series={[{ key: "loans", label: "Prêts", color: "var(--series-1)" }]} /></ChartCard>
            <section className="card flush">
              <div className="card-head"><h2>Derniers inscrits</h2></div>
              <div className="table-card">
                <table className="tbl"><thead><tr><th>Date</th><th>Nom</th><th>E-mail</th><th>Offre</th></tr></thead>
                  <tbody>{s.recentUsers.map((u: any) => <tr key={u.id}><td className="mono nowrap">{dateFr(u.createdAt)}</td><td>{u.name}</td><td>{u.email}</td><td>{PLANS[u.plan as keyof typeof PLANS].name}</td></tr>)}</tbody></table>
              </div>
            </section>
          </>}
        </div>
      )}
    </>
  );
}
