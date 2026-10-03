"use client";
import { useState } from "react";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { LegalLinks } from "./SiteFooter";
import { DayNight } from "./ui";

/** Page étroite sans illustration (mot de passe oublié, confirmation d'adresse, désinscription). */
export function AuthCard({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="auth single">
      <div className="auth-main">
        <div className="auth-top"><Brand href="/" /><DayNight /></div>
        <div className="auth-card">
          <div>
            <h1 className="auth-title">{title}</h1>
            {sub && <p className="auth-sub">{sub}</p>}
          </div>
          {children}
        </div>
        <div className="auth-foot"><LegalLinks /></div>
      </div>
    </main>
  );
}

/** Règle CNIL appliquée côté serveur (src/lib/validation.ts) : 8 caractères et 3 types sur 4. */
export function pwChecks(pw: string) {
  const types = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length;
  return { length: pw.length >= 8, types: types >= 3 };
}

/** Champ mot de passe avec bouton afficher/masquer, et les critères quand on en choisit un nouveau. */
export function PasswordField({ id, label, value, onChange, isNew, autoFocus }: {
  id: string; label: string; value: string; onChange: (v: string) => void; isNew?: boolean; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const checks = pwChecks(value);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw">
        <input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} required minLength={isNew ? 8 : 1}
          autoComplete={isNew ? "new-password" : "current-password"} aria-describedby={isNew ? `${id}-rules` : undefined} autoFocus={autoFocus} />
        <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
          <Icon name={show ? "eyeOff" : "eye"} size={17} />
        </button>
      </div>
      {isNew && (
        <ul className="criteria" id={`${id}-rules`}>
          <li className={checks.length ? "ok" : ""}><span className="c"><Icon name="check" size={9} stroke={3.4} /></span>8 caractères minimum</li>
          <li className={checks.types ? "ok" : ""}><span className="c"><Icon name="check" size={9} stroke={3.4} /></span>3 types parmi : minuscules, majuscules, chiffres, caractères spéciaux</li>
        </ul>
      )}
    </div>
  );
}
