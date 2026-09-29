"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { useMe } from "./Providers";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = useSearchParams().get("next") || "/prets";
  const { refresh } = useMe();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const { token } = await api<{ token: string }>(`/api/auth/${mode}`, { body: form });
      try { localStorage.setItem("token", token); } catch {}
      await refresh();
      router.replace(next.startsWith("/") ? next : "/prets");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 48 }}>
      <Link href="/" className="brand" style={{ justifyContent: "center", marginBottom: 24 }}><span className="brand-dot">P</span>Prêt Matériel</Link>
      <form className="card stack" onSubmit={submit}>
        <h1 style={{ marginBottom: 4 }}>{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
        {err && <div className="alert bad">{err}</div>}
        {mode === "register" && <label className="field">Ton prénom<input value={form.name} onChange={set("name")} required autoComplete="given-name" /></label>}
        <label className="field">E-mail<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
        <label className="field">Mot de passe<input type="password" value={form.password} onChange={set("password")} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        <button className="btn primary block" disabled={busy}>{busy ? "…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
        <p className="small center muted" style={{ margin: 0 }}>
          {mode === "login" ? <>Pas de compte ? <Link href="/inscription">Inscris-toi</Link></> : <>Déjà inscrit ? <Link href="/connexion">Connecte-toi</Link></>}
        </p>
      </form>
    </main>
  );
}
