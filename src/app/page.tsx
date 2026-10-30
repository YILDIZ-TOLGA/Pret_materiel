"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { Icon, type IconName } from "@/components/Icon";
import { useSite } from "@/components/SiteMode";
import { PlanCard } from "@/components/PlanCards";
import { useMe } from "@/components/Providers";
import { SiteFooter } from "@/components/SiteFooter";
import { Avatar, CountUp, DayNight, Reveal, Stamp, useInView } from "@/components/ui";
import { euros } from "@/lib/client";
import { LEGAL } from "@/lib/legal";
import { MAIN_PLAN } from "@/lib/plans";

/* Fiches d'exemple de la pile animée (données fictives, à visée d'illustration). */
type DemoCard = {
  ref: string; kind: "Matériel" | "Argent"; title: string; sub: string; who: string; lent: string; due: string;
  chip: [string, "soon" | "late" | ""]; state: [string, string]; p: [number, number]; note: [IconName, string, string]; stamp: string;
};
const CARDS: DemoCard[] = [
  { ref: "0142", kind: "Matériel", title: "MacBook Pro 14", sub: "Avec chargeur et housse, n° de série C02X…", who: "Léa Martin", lent: "2 sept.", due: "30 sept.",
    chip: ["Demain", "soon"], state: ["À rendre demain", "Rendu à l'instant"], p: [0.78, 0.93], note: ["signature", "Accusé de réception signé", "par Léa, depuis son téléphone"], stamp: "Rendu" },
  { ref: "0143", kind: "Argent", title: "500 €", sub: "Avance sur frais de mission", who: "Julien Petit", lent: "3 oct.", due: "17 oct.",
    chip: ["J-6", ""], state: ["300 € remboursés sur 500 €", "Soldé à l'instant"], p: [0.35, 0.6], note: ["file", "Reçu signé : 300 € reçus", "copie envoyée à Julien"], stamp: "Soldé" },
  { ref: "0144", kind: "Matériel", title: "Perforateur Hilti", sub: "Chantier rue Pasteur, avec coffret", who: "Karim Benali", lent: "1er sept.", due: "15 sept.",
    chip: ["+4 j", "late"], state: ["En retard de 4 jours", "Rendu à l'instant"], p: [0.9, 1], note: ["send", "Relance envoyée à Karim", "4 jours après l'échéance"], stamp: "Rendu" },
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

/** Saisie simulée, au rythme irrégulier d'une vraie frappe, puis choix de la durée. */
function TypedField({ text }: { text: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(text.length); return; }
    let i = 0;
    let t = setTimeout(function tick() {
      i++;
      setN(i);
      if (i < text.length) t = setTimeout(tick, 45 + Math.random() * 85);
    }, 600);
    return () => clearTimeout(t);
  }, [inView, text]);
  const done = n >= text.length;
  return (
    <div className="art-input" ref={ref}>
      <div className="art-field"><span className="typed">{text.slice(0, n)}</span><span className="caret" /></div>
      <div className="art-chips"><span>1 sem.</span><span className={done ? "on" : ""}>2 sem.</span><span>1 mois</span></div>
    </div>
  );
}

/** Signature tracée d'un trait, quand l'étape arrive à l'écran. */
function SignArt() {
  return (
    <div className="art-sign">
      <svg viewBox="0 0 240 80" aria-hidden="true">
        <path className="art-sign-path" pathLength={1} d="M14 58c14-4 20-38 34-38 10 0 2 34 14 34 9 0 11-18 20-18 8 0 6 14 14 14 10 0 16-26 26-26 7 0 5 20 13 20s12-10 22-10 14 6 30 6" />
        <path d="M10 66h220" className="art-sign-line" />
      </svg>
      <span>Signé par Léa Martin · 14:32</span>
    </div>
  );
}

function Steps() {
  return (
    <div className="steps">
      <Reveal className="step">
        <span className="step-n">01</span>
        <h3>Tu enregistres le prêt</h3>
        <p>Du matériel ou une somme, l&apos;emprunteur, la date de retour. Une minute, et la demande de signature part par e-mail.</p>
        <div className="step-art"><TypedField text="Perforateur Hilti" /></div>
      </Reveal>
      <Reveal className="step" delay={120}>
        <span className="step-n">02</span>
        <h3>L&apos;emprunteur signe</h3>
        <p>Il vérifie le récapitulatif et signe l&apos;accusé de réception au doigt, sans créer de compte. Tu reçois le PDF signé, à imprimer.</p>
        <div className="step-art"><SignArt /></div>
      </Reveal>
      <Reveal className="step" delay={240}>
        <span className="step-n">03</span>
        <h3>Rappels, puis reçu signé</h3>
        <p>Rappel la veille, relances en cas de retard. Au retour ou au remboursement, tu signes un reçu : chacun garde sa preuve.</p>
        <div className="step-art"><span className="art-stamp"><Stamp size="lg">Rendu</Stamp></span></div>
      </Reveal>
    </div>
  );
}

const FEATURES: [string, string][] = [
  ["Accusé de réception signé", "L'emprunteur signe en ligne, au doigt ou à la souris. Pour un prêt d'argent, il écrit lui-même la somme en lettres et en chiffres."],
  ["Reçus à imprimer", "Chaque signature produit un PDF daté, avec ses éléments de preuve, envoyé aux deux parties. Imprimé, il reste ta preuve quoi qu'il arrive."],
  ["Remboursements partiels", "26 € reçus sur 50 € ? Tu signes un reçu de 26 €, le reste dû est recalculé et l'emprunteur reçoit sa copie."],
  ["Relances automatiques", "La veille de l'échéance, puis tous les trois jours en cas de retard. Un prêt contesté n'est plus relancé."],
  ["Bilan par personne", "Qui a quoi, qui doit combien, qui rend à l'heure. Export CSV en un clic."],
  ["Respect de l'emprunteur", "Pas de compte à créer, un lien de désinscription dans chaque e-mail, ta structure nommée comme responsable de ses données."],
];

function BilanBand() {
  const [ref, inView] = useInView<HTMLDivElement>();
  const bars = [32, 46, 28, 58, 41, 72, 50, 36, 80, 56, 66, 92];
  return (
    <section className="lp-dark" aria-labelledby="bilan-title">
      <div className={`wrap ${inView ? "in" : ""}`} ref={ref}>
        <div className="lp-kicker">Le bilan</div>
        <h2 className="lp-h2" id="bilan-title">Tout ce qui est dehors, <em>en un coup d&apos;œil.</em></h2>
        <p className="lp-sub">Ce qu&apos;on doit à ta structure, le matériel qui n&apos;est pas revenu, qui rend à l&apos;heure. Mis à jour à chaque prêt, à chaque retour.</p>
        <div className="big-stats">
          <div className="big-stat"><div className="v"><CountUp value={12000} run={inView} format={(n) => euros(Math.round(n / 100) * 100)} /></div><div className="k">On te doit</div></div>
          <div className="big-stat"><div className="v"><CountUp value={14} run={inView} /></div><div className="k">Matériels prêtés</div></div>
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
  ["L'emprunteur doit-il créer un compte ?", "Non. Il reçoit un lien personnel par e-mail, vérifie le récapitulatif et signe l'accusé de réception en ligne, au doigt ou à la souris. Il reçoit ensuite sa copie en PDF, puis les rappels. S'il a un compte, il retrouve aussi ses emprunts dans l'application."],
  ["La signature a-t-elle une valeur juridique ?", "C'est une signature électronique simple : elle ne peut pas être écartée en justice au seul motif qu'elle est électronique (règlement européen eIDAS, article 25 ; articles 1366 et 1367 du Code civil). En cas de contestation, il faut pouvoir montrer qu'elle est fiable : chaque document porte donc la date, l'heure, l'adresse IP, le navigateur et une empreinte numérique. Pour un prêt d'argent, l'emprunteur écrit lui-même la somme en lettres et en chiffres (article 1376 du Code civil)."],
  ["Pourquoi imprimer les reçus ?", "Parce que c'est ta preuve et qu'elle doit résister à tout : panne, suppression du prêt, arrêt du service. Prêt Matériel n'est pas un service d'archivage : chaque document signé t'est envoyé en PDF et reste téléchargeable depuis le prêt, mais c'est ta copie imprimée qui fait foi pour toi."],
  ["Et si l'emprunteur rembourse en plusieurs fois ?", "Tu enregistres chaque somme reçue et tu signes le reçu correspondant, par exemple « 26 € reçus sur 50 € ». L'emprunteur reçoit sa copie et le reste dû est mis à jour. Au dernier versement, le prêt est soldé."],
  ["Le service est-il ouvert aux particuliers ?", "Non. Prêt Matériel est réservé aux entreprises, aux associations et aux autres organismes, pour le matériel ou l'argent qu'ils prêtent dans le cadre de leur activité."],
  ["Puis-je arrêter mon abonnement quand je veux ?", "Oui, depuis la page Offre, en deux clics. L'abonnement reste actif jusqu'à la fin de l'année payée, puis n'est pas reconduit. Tes prêts et tes documents restent consultables."],
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
  const site = useSite();
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
            <a href="#tarifs">Tarif</a>
            <a href="#questions">Questions</a>
          </nav>
          <div className="lp-nav-cta">
            <DayNight />
            {me
              ? <Link href="/prets" className="btn primary">Ouvrir l&apos;application<Icon name="arrowRight" size={15} /></Link>
              : <><Link href="/connexion" className="btn ghost">Connexion</Link><Link href="/inscription" className="btn primary">Créer un compte</Link></>}
          </div>
        </div>
      </header>

      <main>
        <section className="wrap lp-hero">
          <div>
            <div className="lp-kicker" style={{ animation: "rise .8s var(--ease) both" }}>Prêts de matériel et d&apos;argent · entreprises et associations</div>
            <h1 className="lp-h1">
              <span className="ln"><span>Prêté, signé,</span></span>
              <span className="ln"><span><em>rendu.</em></span></span>
            </h1>
            <p className="lp-lead">Ordinateur confié à un salarié, outillage prêté à un client, avance sur frais : enregistre le prêt, l&apos;emprunteur signe l&apos;accusé de réception en ligne, et tu gardes un reçu signé à imprimer. Rappels, relances et reçus de remboursement suivent.</p>
            <div className="lp-ctas">
              <Link href={start} className="btn primary lg">Créer le compte de ma structure<Icon name="arrowRight" size={16} /></Link>
              <a href="#fonctionnement" className="btn ghost lg">Voir comment ça marche</a>
            </div>
            <ul className="lp-assure">
              <li><Icon name="check" size={14} />{site?.mode === "BETA" ? "Gratuit pendant la phase de test" : `${MAIN_PLAN.priceLabel}, tout compris`}</li>
              <li><Icon name="check" size={14} />Sans compte pour l&apos;emprunteur</li>
              <li><Icon name="check" size={14} />Reçus PDF à imprimer</li>
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
              <h2 className="lp-h2" id="how-title">Une signature, <em>et chacun a sa preuve.</em></h2>
              <p className="lp-sub">L&apos;emprunteur reconnaît ce qu&apos;il a reçu, tu reconnais ce qui t&apos;a été rendu. Les documents signés partent en PDF aux deux parties, les rappels partent seuls.</p>
            </Reveal>
            <Steps />
          </div>
        </section>

        <section className="lp-sec" id="fonctionnalites" aria-labelledby="feat-title" style={{ paddingTop: 24 }}>
          <div className="wrap spec">
            <div className="spec-aside">
              <Reveal>
                <div className="lp-kicker">Fonctionnalités</div>
                <h2 className="lp-h2" id="feat-title">Pensé pour le matériel <em>qui circule.</em></h2>
                <p className="lp-sub">Parc informatique, outillage de chantier, matériel de club, avances aux salariés : un registre clair, des preuves signées, des rappels qui partent seuls.</p>
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
              <h2 className="lp-h2" id="price-title">Une offre, <em>tout compris.</em></h2>
              <p className="lp-sub">{euros(MAIN_PLAN.priceCents)} hors taxes par an pour ta structure, résiliable à tout moment. Paiement sécurisé par Stripe, facture au nom de ta structure.</p>
            </Reveal>
            {site?.mode === "BETA" && (
              <div className="banner ok" role="status" style={{ marginBottom: 20 }}>
                <Icon name="info" size={16} />
                <span><strong>Phase de test : tout est gratuit en ce moment</strong>, jusqu&apos;à {site.betaLimits.maxLoans} prêts en cours, accusés de réception et reçus signés compris. L&apos;offre ci-dessous n&apos;est pas encore en vente ; son ouverture sera annoncée au moins 30 jours avant, et rien ne sera supprimé.</span>
              </div>
            )}
            <div className="plans solo">
              <Reveal>
                <PlanCard plan={MAIN_PLAN.id} featured>
                  {site?.mode === "BETA"
                    ? <Link href={start} className="btn primary block">Gratuit pendant la phase de test</Link>
                    : <Link href={me ? "/abonnement" : "/inscription"} className="btn primary block">Choisir l&apos;offre {MAIN_PLAN.name}</Link>}
                </PlanCard>
              </Reveal>
            </div>
            <p className="lp-fine" style={{ textAlign: "center" }}>Prix hors taxes. {LEGAL.vatMention}. Service réservé aux professionnels.</p>
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
          <h2 className="lp-h2">Le prochain prêt, <em>fais-le signer.</em></h2>
          <div className="lp-ctas"><Link href={start} className="btn primary lg">Créer le compte de ma structure<Icon name="arrowRight" size={16} /></Link></div>
        </Reveal>
      </main>

      <SiteFooter />
    </div>
  );
}
