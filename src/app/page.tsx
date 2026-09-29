"use client";
import Link from "next/link";
import { useMe } from "@/components/Providers";
import { PLANS } from "@/lib/plans";

const FEATURES = [
  ["📝", "Note chaque prêt en 10 secondes", "Un objet ou de l'argent, la personne, son e-mail, la date de retour. C'est tout."],
  ["💶", "Prêts d'argent", "Suis ce qu'on te doit, note les remboursements partiels, le reste se calcule tout seul."],
  ["📊", "Ton bilan", "Qui a quoi, qui te doit combien, qui rend à l'heure : tout sur un seul écran."],
  ["📧", "Rappels automatiques", "La personne reçoit un e-mail au moment du prêt, la veille de l'échéance, puis des relances si c'est en retard."],
  ["🔔", "Alertes pour toi", "Tu es prévenu dès qu'un prêt dépasse sa date. Tu clôtures en un clic quand l'objet revient."],
  ["🤝", "Notifications entre membres", "Si l'emprunteur a un compte, il voit ses emprunts et reçoit les alertes directement dans l'appli."],
];

export default function Home() {
  const { me } = useMe();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand"><span className="brand-dot">P</span>Prêt Matériel</span>
          <nav className="topnav">
            {me ? <Link href="/prets" className="btn small primary">Mon espace</Link> : <>
              <Link href="/connexion">Connexion</Link>
              <Link href="/inscription" className="btn small primary">Créer un compte</Link>
            </>}
          </nav>
        </div>
      </header>
      <main className="container">
        <section className="landing-hero">
          <h1>Tu prêtes. On pense à te le faire rendre.</h1>
          <p>Perceuse, livre, console, 50 € pour le resto… Note tes prêts, et Prêt Matériel relance la personne pour toi.</p>
          <Link href={me ? "/prets/nouveau" : "/inscription"} className="btn primary">Commencer gratuitement</Link>
        </section>
        <div className="grid grid-2">
          {FEATURES.map(([ico, title, text]) => (
            <div key={title} className="card feature">
              <div className="loan-ico">{ico}</div>
              <div><strong>{title}</strong><p className="muted small" style={{ margin: "4px 0 0" }}>{text}</p></div>
            </div>
          ))}
        </div>
        <h2 style={{ marginTop: 32 }}>Tarifs</h2>
        <div className="plans">
          {Object.values(PLANS).map((p) => (
            <div key={p.id} className="card plan">
              <strong>{p.name}</strong>
              <div className="price">{p.priceLabel}</div>
              <div className="muted small">{p.tagline}</div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
