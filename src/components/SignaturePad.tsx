"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SIGNATURE_BOX, type SignatureData } from "@/lib/signature";
import { Icon } from "./Icon";
import { useTheme } from "./ui";

/**
 * Zone de signature au doigt, au stylet ou à la souris. Le tracé est enregistré en points dans une zone de
 * référence de 600 × 200 unités, quelle que soit la taille à l'écran (src/lib/signature.ts) : le PDF le
 * redessine à l'identique. Pour qui ne peut pas tracer, la signature au clavier (nom saisi) reste possible.
 * Textes neutres : la même zone sert à l'emprunteur (vouvoyé) et au prêteur (tutoyé).
 */
export function SignaturePad({ value, onChange, name }: { value: SignatureData | null; onChange: (s: SignatureData | null) => void; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][]>([]);
  const current = useRef<number[] | null>(null);
  const frame = useRef(0);
  const [drawing, setDrawing] = useState(false);
  const { dark } = useTheme();
  const typed = !!value && "typed" in value;

  const redraw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(w / SIGNATURE_BOX.w, 0, 0, h / SIGNATURE_BOX.h, 0, 0);
    ctx.strokeStyle = getComputedStyle(c).color;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of current.current ? [...strokes.current, current.current] : strokes.current) {
      if (s.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      if (s.length === 2) ctx.lineTo(s[0] + 0.5, s[1] + 0.5);
      // même lissage que signaturePath : courbes passant par le milieu des segments
      for (let i = 2; i + 3 < s.length; i += 2) ctx.quadraticCurveTo(s[i], s[i + 1], (s[i] + s[i + 2]) / 2, (s[i + 1] + s[i + 3]) / 2);
      if (s.length > 2) ctx.lineTo(s[s.length - 2], s[s.length - 1]);
      ctx.stroke();
    }
  }, []);
  const schedule = () => { cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(redraw); };

  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c) return;
    redraw();
    const ro = new ResizeObserver(redraw);
    ro.observe(c);
    return () => { ro.disconnect(); cancelAnimationFrame(frame.current); };
  }, [redraw, typed]);
  // l'encre suit le mode jour / nuit
  useEffect(() => { redraw(); }, [dark, redraw]);
  // remise à zéro par le parent (après envoi, ou « Effacer »)
  useEffect(() => { if (value === null && strokes.current.length) { strokes.current = []; redraw(); } }, [value, redraw]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number, max: number) => Math.round(Math.min(max, Math.max(0, v)));
    return [clamp(((e.clientX - r.left) / r.width) * SIGNATURE_BOX.w, SIGNATURE_BOX.w), clamp(((e.clientY - r.top) / r.height) * SIGNATURE_BOX.h, SIGNATURE_BOX.h)];
  };
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = point(e);
    setDrawing(true);
    schedule();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = current.current;
    if (!s) return;
    const [x, y] = point(e);
    if (Math.hypot(x - s[s.length - 2], y - s[s.length - 1]) < 2) return;
    s.push(x, y);
    schedule();
  }
  function up() {
    const s = current.current;
    current.current = null;
    setDrawing(false);
    if (!s) return;
    if (strokes.current.length < 80 && s.length <= 4000) strokes.current = [...strokes.current, s];
    schedule();
    onChange({ ...SIGNATURE_BOX, strokes: strokes.current.map((x) => [...x]) });
  }
  function clear() {
    strokes.current = [];
    current.current = null;
    redraw();
    onChange(null);
  }

  const empty = !value || (!typed && !strokes.current.length);
  return (
    <div className="sigpad-wrap">
      <div className={`sigpad ${drawing ? "drawing" : ""} ${typed ? "typed" : ""}`}>
        {typed ? (
          <div className="sigpad-typed" aria-live="polite">
            <span className="sigpad-name">{name.trim() || "Nom et prénom"}</span>
            <span className="sigpad-cap">Signature au clavier : le nom saisi plus haut tient lieu de signature</span>
          </div>
        ) : (
          <>
            <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              role="img" aria-label="Zone de signature : signer avec le doigt, un stylet ou la souris" />
            {empty && !drawing && <span className="sigpad-hint" aria-hidden="true">Signer ici</span>}
          </>
        )}
        <span className="sigpad-line" aria-hidden="true" />
      </div>
      <div className="sigpad-bar">
        {typed
          ? <button type="button" className="link-btn" onClick={() => onChange(null)}><Icon name="pencil" size={13} />Tracer la signature</button>
          : <button type="button" className="link-btn" onClick={() => onChange({ typed: true })}>Impossible de tracer ? Signer au clavier</button>}
        {!typed && <button type="button" className="btn small ghost" onClick={clear} disabled={empty}><Icon name="undo" size={14} />Effacer</button>}
      </div>
    </div>
  );
}
