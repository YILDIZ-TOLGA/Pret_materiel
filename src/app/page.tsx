"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon, type IconName } from "@/components/Icon";
import { useMe } from "@/components/Providers";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, CountUp, Reveal, Stamp, useInView } from "@/components/ui";
import { euros } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import { PLANS } from "@/lib/plans";

/* Fiches d'exemple de la pile animée (données fictives, à visée d'illustration). */
type DemoCard = {
  ref: string; kind: "Objet" | "Argent"; title: string; sub: string; who: string; lent: string; due: string;
  chip: [string, "soon" | "late" | ""]; state: [string, string]; p: [number, number]; note: [IconName, string, string]; stamp: string;
};
const CARDS: DemoCard[] = [
  { ref: "0142", kind: "Objet", title: "Perceuse Bosch", sub: "Avec les deux batteries", who: "Léa", lent: "12 sept.", due: "26 sept.",
    chip: ["Demain", "soon"], state: ["À rendre demain", "Rendue à l'instant"], p: [0.78, 0.93], note: ["mail", "Rappel envoyé à Léa", "la veille de l'échéance"], stamp: "Rendu" },
  { ref: "0143", kind: "Argent", title: "50 €", sub: "Resto du vendredi", who: "Karim", lent: "3 oct.", due: "17 oct.",
    chip: ["J-6", ""], state: ["30 € remboursés sur 50 €", "Soldé à l'instant"], p: [0.35, 0.6], note: ["banknote", "Karim a remboursé 30 €", "reste 20 € à récupérer"], stamp: "Soldé" },
  { ref: "0144", kind: "Objet", title: "Dune, tome 1", sub: "Édition poche", who: "Inès", lent: "1er sept.", due: "15 sept.",
    chip: ["+4 j", "late"], state: ["En retard de 4 jours", "Rendu à l'instant"], p: [0.9, 1], note: ["send", "Relance envoyée à Inès", "4 jours après l'échéance"], stamp: "Rendu" },
];

function Deck() {
  const [order, setOrder] = useState([0, 1, 2]);
  const [phase, setPhase] = useState(0);
  const [out, setOut] = useState<number | null>(null);
  const [entering, setEntering] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ref, inView] = useInView<HTMLDivElement>("0px");

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(r);
    if (r) setPhase(2);
  }, []);

  // Cycle de la fiche du dessus : rappel → tampon → la fiche s'en va, la suivante avance.
  useEffect(() => {
    if (reduced || !inView) return;
    const front = order[0];
    setPhase(0);
    const timers = [
      setTimeout(() => setPhase(1), 900),
      setTimeout(() => setPhase(2), 2700),
      setTimeout(() => setOut(front), 4300),
      setTimeout(() => { setOut(null); setEntering(front); setOrder((o) => [...o.slice(1), o[0]]); }, 4900),
    ];
    return () => timers.forEach(clearTimeout);
  }, [order, reduced, inView]);
  // La fiche partie revient au fond de la pile : invisible une image, puis fondu à sa place.
  useEffect(() => {
    if (entering === null) return;
    const t = setTimeout(() => setEntering(null), 60);
    return () => clearTimeout(t);
  }, [entering]);

  const pos = (i: number) => {
    if (i === out) return "out";
    if (i === entering) return "enter";
    const idx = order.indexOf(i);
    return String(out !== null ? idx - 1 : idx);
  };
  const front = CARDS[order[0]];

  return (
    <div className="deck" ref={ref} aria-hidden="true">
      <div className={`deck-note ${phase === 1 && out === null ? "show" : ""}`}>
        <span className="ico"><Icon name={front.note[0]} size={15} /></span>
        <span>{front.note[1]}<small>{front.note[2]}</small></span>
      </div>
      {CARDS.map((c, i) => {
        const isFront = i === order[0];
        const f = isFront ? phase : 0;
        const done = f >= 2;
        return (
          <div key={c.ref} className="deck-card" data-pos={pos(i)}>
            <div className="fiche">
              <div className={`fiche-part fiche-head ${done ? "has-stamp" : ""}`}>
                <div className="fiche-top"><span>Fiche n° {c.ref}</span><span className="sep">/</span><span>{c.kind}</span></div>
                <div className="fiche-title">{c.title}</div>
                <p className="fiche-desc">{c.sub}</p>
                <div className="fiche-state">
                  <span className={`due ${done ? "done" : c.chip[1]}`}>{done ? (c.kind === "Argent" ? "Remboursé" : "Rendu") : c.chip[0]}</span>
                  <span>{done ? c.state[1] : c.kind === "Argent" && f < 1 ? "À rembourser dans 6 jours" : c.state[0]}</span>
                </div>
                {done && <div className="fiche-stamp"><Stamp state={reduced ? undefined : "in"} size="lg">{c.stamp}</Stamp></div>}
              </div>
              <div className="fiche-part fiche-body">
                <dl className="fiche-grid">
                  <div><dt>Emprunteur</dt><dd><Avatar name={c.who} size="sm" />{c.who}</dd></div>
                  <div><dt>{c.kind === "Argent" ? "À rembourser le" : "À rendre le"}</dt><dd className="mono">{c.due}</dd></div>
                </dl>
                <div className={`period ${done ? "" : c.chip[1]}`}>
                  <div className="period-head"><span>Durée du prêt</span><span>{c.lent} → {c.due}</span></div>
                  <div className="period-track"><i style={{ "--p": f >= 1 ? c.p[1] : c.p[0] } as React.CSSProperties} /></div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Steps() {
  return (
    <div className="steps">
      <Reveal className="step">
        <span className="step-n">01</span>
        <h3>Tu notes le prêt</h3>
        <p>Un objet ou une somme, la personne, la date de retour. Vingt secondes, montre en main.</p>
        <div className="step-art">
          <div className="art-input">
            <div className="art-field"><span className="typed">Perceuse Bosch</span><span className="caret" /></div>
            <div className="art-chips"><span>1 sem.</span><span className="on">2 sem.</span><span>1 mois</span></div>
          </div>
        </div>
      </Reveal>
      <Reveal className="step" delay={120}>
        <span className="step-n">02</span>
        <h3>On prévient, puis on relance</h3>
        <p>Un e-mail à la création, un rappel la veille de l&apos;échéance, puis une relance tous les trois jours si le retard dure.</p>
        <div className="step-art">
          <div className="art-mail">
            <span className="ico"><Icon name="mail" size={15} /></span>
            <div><b>Demain : « Perceuse Bosch » à rendre à Sam</b><span>Prêt Matériel · la veille de l&apos;échéance</span></div>
          </div>
        </div>
      </Reveal>
      <Reveal className="step" delay={240}>
        <span className="step-n">03</span>
        <h3>Tu clôtures</h3>
        <p>Quand l&apos;objet revient, un clic. Les rappels s&apos;arrêtent et ton bilan se met à jour.</p>
        <div className="step-art"><span className="art-stamp"><Stamp size="lg">Rendu</Stamp></span></div>
      </Reveal>
    </div>
  );
}

const FEATURES: [string, string][] = [
  ["Objets et argent", "Remboursements partiels notés au fil de l'eau, reste dû calculé pour toi."],
  ["Relances automatiques", "La veille de l'échéance, puis tous les trois jours si le retard dure. Tu peux aussi relancer à la main."],
  ["Alertes de retard", "Tu es prévenu dans l'application dès qu'une date de retour est dépassée."],
  ["Bilan par personne", "Qui a quoi, qui te doit combien, qui rend à l'heure. Export CSV en un clic."],
  ["Espace emprunteur", "Si l'emprunteur a un compte, il retrouve ses emprunts et ses échéances."],
  ["Respect de l'emprunteur", "Chaque e-mail permet de se désinscrire en un clic. Pas de publicité, pas de revente de données."],
];

function BilanBand() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const bars = [32, 46, 28, 58, 41, 72, 50, 36, 80, 56, 66, 92];
  return (
    <section className="lp-dark" aria-labelledby="bilan-title">
      <div className={`wrap ${inView ? "in" : ""}`} ref={ref}>
        <div className="lp-kicker">Le bilan</div>
        <h2 className="lp-h2" id="bilan-title">Tout ce qui est dehors, <em>en un coup d&apos;œil.</em></h2>
        <p className="lp-sub">Ce qu&apos;on te doit, ce qui n&apos;est pas revenu, qui rend à l&apos;heure. Mis à jour à chaque prêt, à chaque retour.</p>
        <div className="big-stats">
          <div className="big-stat"><div className="v"><CountUp value={12000} run={inView} format={(n) => euros(Math.round(n / 100) * 100)} /></div><div className="k">On te doit</div></div>
          <div className="big-stat"><div className="v"><CountUp value={3} run={inView} /></div><div className="k">Objets chez les autres</div></div>
          <div className="big-stat"><div className="v"><CountUp value={92} run={inView} format={(n) => `${Math.round(n)} %`} /></div><div className="k">Rendus à l&apos;heure</div></div>
        </div>
        <div className="mini-bars" aria-hidden="true">
          {bars.map((h, i) => <i key={i} className={i === bars.length - 1 ? "hi" : ""} style={{ "--hh": `${h}%`, "--i": i } as React.CSSProperties} />)}
        </div>
        <div className="mono-caption">Exemple de bilan</div>
      </div>
    </section>
  );
}

const FAQ: [string, string][] = [
  ["L'emprunteur doit-il créer un compte ?", "Non. Il reçoit simplement les e-mails liés au prêt : la confirmation, un rappel la veille de l'échéance et, si tu l'as activée, une relance tous les trois jours en cas de retard. S'il a un compte, il retrouve aussi ses emprunts dans l'application."],
  ["Que voit l'emprunteur exactement ?", "Ton prénom, ton adresse e-mail pour te contacter, ce qui a été prêté et les dates. Tes notes privées ne lui sont jamais montrées, et chaque e-mail lui permet de se désinscrire en un clic."],
  ["Est-ce que ça vaut reconnaissance de dette ?", "Non : les informations enregistrées sont déclaratives. Pour un prêt d'argent de plus de 1 500 €, la loi exige un écrit signé par l'emprunteur (article 1359 du Code civil)."],
  ["Puis-je arrêter mon abonnement quand je veux ?", "Oui. L'offre mensuelle est sans engagement et se résilie depuis la page Offre, en deux clics. À la fin de la période payée, ton compte repasse à l'offre gratuite et tes prêts sont conservés."],
  ["Et mes données ?", "Pas de publicité, pas de revente. Tu peux télécharger toutes tes données ou supprimer ton compte à tout moment depuis la page Mon compte."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {FAQ.map(([q, a], i) => {
        const on = open === i;
        return (
          <div key={q} className={`faq-item ${on ? "open" : ""}`}>
            <button type="button" className="faq-q" aria-expanded={on} aria-controls={`faq-${i}`} onClick={() => setOpen(on ? null : i)}>
              {q}<span className="faq-pm"><Icon name="plus" size={15} /></span>
            </button>
            <div className="faq-a" id={`faq-${i}`} role="region" inert={!on}><div><p>{a}</p></div></div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const { me } = useMe();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const start = me ? "/prets/nouveau" : "/inscription";

  return (
    <div className="lp">
      <header className={`lp-nav ${scrolled ? "scrolled" : ""}`}>
        <div className="wrap lp-nav-in">
          <Brand href="/" />
          <nav className="lp-links" aria-label="Sections">
            <a href="#fonctionnement">Fonctionnement</a>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#tarifs">Tarifs</a>
            <a href="#questions">Questions</a>
          </nav>
          <div className="lp-nav-cta">
            {me
              ? <Link href="/prets" className="btn primary">Ouvrir l&apos;application<Icon name="arrowRight" size={15} /></Link>
              : <><Link href="/connexion" className="btn ghost">Connexion</Link><Link href="/inscription" className="btn primary">Créer un compte</Link></>}
          </div>
        </div>
      </header>

      <main>
        <section className="wrap lp-hero">
          <div>
            <div className="lp-kicker" style={{ animation: "rise .8s var(--ease) both" }}>Prêts d&apos;objets et d&apos;argent entre proches</div>
            <h1 className="lp-h1">
              <span className="ln"><span>Ce que tu prêtes</span></span>
              <span className="ln"><span><em>revient.</em></span></span>
            </h1>
            <p className="lp-lead">Perceuse, livres, console ou 50 € pour le resto : note le prêt en quelques secondes. Prêt Matériel prévient l&apos;emprunteur, le relance s&apos;il oublie, et te dit qui te doit quoi.</p>
            <div className="lp-ctas">
              <Link href={start} className="btn primary lg">Créer mon carnet<Icon name="arrowRight" size={16} /></Link>
              <a href="#fonctionnement" className="btn ghost lg">Voir comment ça marche</a>
            </div>
            <ul className="lp-assure">
              <li><Icon name="check" size={14} />Gratuit pour un prêt en cours</li>
              <li><Icon name="check" size={14} />Sans carte bancaire</li>
              <li><Icon name="check" size={14} />Résiliable à tout moment</li>
            </ul>
          </div>
          <div>
            <Deck />
            <p className="deck-caption">Fiches d&apos;exemple</p>
          </div>
        </section>

        <section className="lp-sec" id="fonctionnement" aria-labelledby="how-title">
          <div className="wrap">
            <Reveal className="lp-sec-head">
              <div className="lp-kicker">Fonctionnement</div>
              <h2 className="lp-h2" id="how-title">Trois gestes, <em>zéro relance gênante.</em></h2>
              <p className="lp-sub">Tu n&apos;as plus à jouer les huissiers : les rappels partent automatiquement, signés de ton prénom, sur un ton cordial.</p>
            </Reveal>
            <Steps />
          </div>
        </section>

        <section className="lp-sec" id="fonctionnalites" aria-labelledby="feat-title" style={{ paddingTop: 24 }}>
          <div className="wrap spec">
            <div className="spec-aside">
              <Reveal>
                <div className="lp-kicker">Fonctionnalités</div>
                <h2 className="lp-h2" id="feat-title">Pensé pour les prêts <em>entre proches.</em></h2>
                <p className="lp-sub">Ni tableur, ni rappels dans un coin de la tête. Un carnet clair, qui fait le suivi à ta place.</p>
              </Reveal>
            </div>
            <ul className="spec-list">
              {FEATURES.map(([t, d], i) => (
                <Reveal as="li" key={t} className="spec-item" delay={i * 60}>
                  <span className="n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        <BilanBand />

        <section className="lp-sec lp-pricing" id="tarifs" aria-labelledby="price-title">
          <div className="wrap">
            <Reveal className="lp-sec-head">
              <div className="lp-kicker">Tarifs</div>
              <h2 className="lp-h2" id="price-title">Gratuit pour commencer, <em>dès 1 € par mois</em> pour aller plus loin.</h2>
              <p className="lp-sub">Prix TTC, sans engagement. Paiement sécurisé par Stripe.</p>
            </Reveal>
            <div className="plans">
              {Object.values(PLANS).map((p, i) => (
                <Reveal key={p.id} delay={i * 80}>
                  <div className={`plan ${p.id === "YEARLY_10" ? "featured" : ""}`}>
                  <div className="plan-name">{p.name}{p.id === "YEARLY_10" && <span className="tag brand">−50 % vs mensuel</span>}</div>
                  <div className="plan-price">{euros(p.priceCents)}{p.interval && <small>/ {p.interval === "month" ? "mois" : "an"}</small>}</div>
                  <div className="plan-eq">{p.interval === "year" ? `soit ${euros(Math.round(p.priceCents / 12))} par mois` : p.interval === "month" ? "sans engagement" : "sans carte bancaire"}</div>
                  <ul>
                    <li><Icon name="check" size={14} />{p.maxLoans} prêt{p.maxLoans > 1 ? "s" : ""} en cours</li>
                    <li><Icon name="check" size={14} />Rappels et relances automatiques</li>
                    <li><Icon name="check" size={14} />Bilan et export CSV</li>
                  </ul>
                  <Link href={p.id === "FREE" ? start : me ? "/abonnement" : "/inscription"} className={`btn block ${p.id === "YEARLY_10" ? "primary" : ""}`}>
                    {p.id === "FREE" ? "Commencer gratuitement" : "Choisir cette offre"}
                  </Link>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="lp-fine">{LEGAL.vatMention}.</p>
          </div>
        </section>

        <section className="lp-sec" id="questions" aria-labelledby="faq-title" style={{ paddingTop: 24 }}>
          <div className="wrap">
            <Reveal className="lp-sec-head">
              <div className="lp-kicker">Questions</div>
              <h2 className="lp-h2" id="faq-title">Les réponses <em>avant de prêter.</em></h2>
            </Reveal>
            <Faq />
          </div>
        </section>

        <Reveal as="section" className="wrap lp-final">
          <div className="lp-kicker">Prêt Matériel</div>
          <h2 className="lp-h2">Le prochain objet que tu prêtes, <em>note-le ici.</em></h2>
          <div className="lp-ctas"><Link href={start} className="btn primary lg">Créer mon carnet<Icon name="arrowRight" size={16} /></Link></div>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
