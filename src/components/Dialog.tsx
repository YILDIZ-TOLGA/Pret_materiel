"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

type ConfirmOpts = { title: string; body?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; icon?: IconName };
const Ctx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

/** `const ok = await confirm({ title: "Supprimer ?", danger: true })` — remplace window.confirm. */
export const useConfirm = () => useContext(Ctx);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [d, setD] = useState<ConfirmOpts | null>(null);
  const [closing, setClosing] = useState(false);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    lastFocus.current = document.activeElement as HTMLElement | null;
    setClosing(false);
    setD(o);
  }), []);

  const close = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setClosing(true);
    setTimeout(() => { setD(null); setClosing(false); lastFocus.current?.focus?.(); }, 160);
  }, []);

  useEffect(() => {
    if (!d) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buttons = box.current?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[d.danger ? 0 : buttons.length - 1]?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [d]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); close(false); }
    if (e.key === "Tab") {
      const els = [...(box.current?.querySelectorAll<HTMLElement>("button, a[href], input") ?? [])];
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : (i === els.length - 1 ? 0 : i + 1);
      e.preventDefault();
      els[next].focus();
    }
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {d && (
        <div className={`overlay ${closing ? "closing" : ""}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div ref={box} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby={d.body ? "dlg-body" : undefined} onKeyDown={onKey}>
            {d.icon && <div className={`dialog-ico ${d.danger ? "danger" : ""}`}><Icon name={d.icon} size={20} /></div>}
            <h2 id="dlg-title">{d.title}</h2>
            {d.body && <div id="dlg-body" className="dialog-body">{d.body}</div>}
            <div className="dialog-actions">
              <button type="button" className="btn ghost" onClick={() => close(false)}>{d.cancelLabel ?? "Annuler"}</button>
              <button type="button" className={`btn ${d.danger ? "danger solid" : "primary"}`} onClick={() => close(true)}>{d.confirmLabel ?? "Confirmer"}</button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
