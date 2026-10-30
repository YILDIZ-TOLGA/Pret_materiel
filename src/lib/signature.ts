/**
 * Signature tracée au doigt ou à la souris : une liste de traits, chacun en coordonnées entières
 * [x1, y1, x2, y2, …] dans une zone de w × h unités. On garde le tracé, pas une image : le document PDF
 * le redessine net, il pèse quelques Ko, et le serveur peut vérifier qu'il n'est pas vide.
 * `typed` : signature au clavier (nom saisi), pour qui ne peut pas tracer (accessibilité).
 * Pas de dépendance : utilisé par la page de signature et par le serveur.
 */
export type DrawnSignature = { w: number; h: number; strokes: number[][] };
export type SignatureData = DrawnSignature | { typed: true };

/** Zone de tracé de référence (le composant SignaturePad enregistre dans ces unités). */
export const SIGNATURE_BOX = { w: 600, h: 200 };

export const isDrawn = (s: SignatureData): s is DrawnSignature => "strokes" in s;

/** Problème d'un tracé (trop court, hors cadre…), ou null s'il est recevable. */
export function signatureProblem(s: DrawnSignature): string | null {
  let points = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const stroke of s.strokes) {
    if (stroke.length % 2) return "Tracé de signature invalide";
    for (let i = 0; i < stroke.length; i += 2) {
      const x = stroke[i], y = stroke[i + 1];
      if (x > s.w || y > s.h) return "Tracé de signature invalide";
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      points++;
    }
  }
  if (points > 6000) return "Tracé de signature trop long";
  // un point ou un petit trait ne suffit pas : il faut un vrai tracé
  if (points < 8 || (maxX - minX < s.w * 0.12 && maxY - minY < s.h * 0.25)) return "Signature trop courte : signer dans le cadre, comme sur papier";
  return null;
}

/** Chemin SVG lissé (courbes par le milieu des segments) : le même à l'écran et dans le PDF. */
export function signaturePath(s: DrawnSignature) {
  let d = "";
  for (const stroke of s.strokes) {
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < stroke.length; i += 2) pts.push([stroke[i], stroke[i + 1]]);
    if (!pts.length) continue;
    const [x0, y0] = pts[0];
    if (pts.length === 1) { d += `M${x0} ${y0}L${x0 + 1} ${y0 + 1}`; continue; }
    d += `M${x0} ${y0}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      d += `Q${x1} ${y1} ${(x1 + x2) / 2} ${(y1 + y2) / 2}`;
    }
    const [xl, yl] = pts[pts.length - 1];
    d += `L${xl} ${yl}`;
  }
  return d;
}
