"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { markUnloading } from "@/lib/client";
import { Icon } from "./Icon";

type Tone = "success" | "error" | "info";
type Item = { id: number; tone: Tone; text: string; action?: { label: string; onClick: () => void }; duration: number; timed: boolean; out?: boolean };
type ShowOpts = { tone?: Tone; text: string; action?: { label: string; onClick: () => void }; duration?: number };
type DeferOpts = {
  text: string;
  /** Exécutée à la fin du délai, sauf si l'utilisateur annule. */
  run: () => Promise<unknown>;
  onUndo?: () => void;
  onError?: (e: Error) => void;
  delay?: number;
};
type ToastApi = { show: (o: ShowOpts) => number; dismiss: (id: number) => void; defer: (o: DeferOpts) => void };

const Ctx = createContext<ToastApi>({ show: () => 0, dismiss: () => {}, defer: () => {} });
export const useToast = () => useContext(Ctx);

type Timer = { remaining: number; start: number; handle?: ReturnType<typeof setTimeout>; done: () => void };

/**
 * Toasts en bas de l'écran. `defer` affiche « Annuler » et ne lance l'action qu'à la fin du délai
 * (comme l'envoi différé d'un e-mail) : annuler ne laisse donc aucune trace côté serveur.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const timers = useRef(new Map<number, Timer>());
  const pending = useRef(new Map<number, () => void>());
  const seq = useRef(0);

  const remove = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t?.handle) clearTimeout(t.handle);
    timers.current.delete(id);
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 230);
  }, []);

  const start = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t) return;
    t.start = Date.now();
    t.handle = setTimeout(() => { timers.current.delete(id); t.done(); }, Math.max(0, t.remaining));
  }, []);
  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t?.handle) return;
    clearTimeout(t.handle);
    t.handle = undefined;
    t.remaining -= Date.now() - t.start;
  }, []);
  const resume = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t && !t.handle) start(id);
  }, [start]);

  const push = useCallback((item: Omit<Item, "id">, onDone: (id: number) => void) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { ...item, id }]);
    timers.current.set(id, { remaining: item.duration, start: Date.now(), done: () => onDone(id) });
    start(id);
    return id;
  }, [start]);

  const show = useCallback((o: ShowOpts) => {
    const duration = o.duration ?? (o.action ? 6000 : 4200);
    let id = 0;
    const action = o.action && { label: o.action.label, onClick: () => { o.action!.onClick(); remove(id); } };
    id = push({ tone: o.tone ?? "success", text: o.text, action, duration, timed: !!o.action }, remove);
    return id;
  }, [push, remove]);

  const defer = useCallback((o: DeferOpts) => {
    let settled = false;
    let id = 0;
    const run = () => {
      if (settled) return;
      settled = true;
      pending.current.delete(id);
      Promise.resolve().then(o.run).catch((e: Error) => {
        o.onError?.(e);
        show({ tone: "error", text: e?.message || "Action impossible, réessaie." });
      });
    };
    const undo = () => {
      if (settled) return;
      settled = true;
      pending.current.delete(id);
      remove(id);
      o.onUndo?.();
    };
    id = push({ tone: "success", text: o.text, duration: o.delay ?? 5000, timed: true, action: { label: "Annuler", onClick: undo } }, (tid) => { remove(tid); run(); });
    pending.current.set(id, run);
  }, [push, remove, show]);

  // Fermeture de l'onglet pendant le délai d'annulation : l'action part quand même.
  useEffect(() => {
    const flush = () => {
      if (!pending.current.size) return;
      markUnloading();
      for (const run of [...pending.current.values()]) run();
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const close = (t: Item) => {
    const run = pending.current.get(t.id);
    remove(t.id);
    run?.();
  };

  const value = useMemo(() => ({ show, dismiss: remove, defer }), [show, remove, defer]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.tone} ${t.out ? "out" : ""}`} style={{ "--dur": `${t.duration}ms` } as React.CSSProperties}
            onMouseEnter={() => pause(t.id)} onMouseLeave={() => resume(t.id)}>
            <span className="toast-ico"><Icon name={t.tone === "error" ? "x" : t.tone === "info" ? "info" : "check"} size={12} stroke={2.6} /></span>
            <span className="toast-text">{t.text}</span>
            {t.action && <button type="button" className="toast-action" onClick={t.action.onClick}>{t.action.label}</button>}
            <button type="button" className="toast-close" aria-label="Fermer" onClick={() => close(t)}><Icon name="x" size={14} /></button>
            {t.timed && <span className="toast-bar" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
