import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { LineCapStyle, PDFDocument, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { ReceiptKind } from "@prisma/client";
import { amountInFigures, amountInWords } from "./amount-words";
import { LEGAL } from "./legal";
import { docDateTime, docDay, type ReceiptContent } from "./receipt-text";
import { isDrawn, signaturePath, type SignatureData } from "./signature";

/**
 * PDF d'un document signé (accusé de réception, reçu de remboursement, attestation de restitution), recalculé
 * à l'identique depuis le contenu figé à la signature. Police du site (Schibsted Grotesk, licence OFL, dans
 * assets/fonts) embarquée : accents, « € » et noms étrangers (ı, ş, ğ…) s'impriment correctement.
 */
export type PdfReceipt = {
  number: string; kind: ReceiptKind; content: ReceiptContent; signature: SignatureData;
  signerName: string; signerEmail: string; signedAt: Date; ip: string | null; userAgent: string | null; hash: string;
};

let fonts: { regular: Buffer; bold: Buffer } | null = null;
const fontFiles = () => (fonts ??= {
  regular: readFileSync(path.join(process.cwd(), "assets/fonts/SchibstedGrotesk-Regular.ttf")),
  bold: readFileSync(path.join(process.cwd(), "assets/fonts/SchibstedGrotesk-Bold.ttf")),
});

const A4 = { w: 595.28, h: 841.89 };
const M = { x: 56, top: 50, bottom: 72 };
const WIDTH = A4.w - 2 * M.x;
const C = {
  ink: rgb(0.09, 0.098, 0.11), ink2: rgb(0.294, 0.31, 0.337), ink3: rgb(0.392, 0.408, 0.435),
  line: rgb(0.83, 0.81, 0.765), soft: rgb(0.973, 0.965, 0.945), brand: rgb(0.118, 0.357, 0.278),
};

export async function receiptPdf(r: PdfReceipt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const { regular, bold } = fontFiles();
  const F = { r: await doc.embedFont(regular, { subset: true }), b: await doc.embedFont(bold, { subset: true }) };
  const c = r.content;
  doc.setTitle(`${c.title} n° ${r.number}`, { showInWindowTitleBar: true });
  doc.setAuthor(LEGAL.siteName);
  doc.setSubject(`${c.title} — ${c.lender.organization ?? c.lender.name} / ${c.borrower.name}`);
  doc.setCreator(LEGAL.siteName);
  doc.setProducer(LEGAL.siteName);
  doc.setCreationDate(r.signedAt);
  doc.setModificationDate(r.signedAt);
  doc.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));

  // Caractères absents de la police (emoji…) remplacés, espace fine insécable remplacée par une insécable
  const known = new Set(F.r.getCharacterSet());
  const clean = (s: string) => [...s.replace(/ /g, " ")].map((ch) => (known.has(ch.codePointAt(0)!) || ch === "\n" ? ch : "?")).join("");

  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;
  const newPage = () => { page = doc.addPage([A4.w, A4.h]); y = A4.h - M.top; };
  const ensure = (h: number) => { if (y - h < M.bottom) newPage(); };

  /** Découpe en lignes de largeur max (un mot trop long, comme une adresse e-mail, est coupé). */
  function lines(text: string, font: PDFFont, size: number, max: number) {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let cur = "";
      for (const word of para.split(/ +/)) {
        const tryLine = cur ? `${cur} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) <= max) { cur = tryLine; continue; }
        if (cur) out.push(cur);
        cur = word;
        while (font.widthOfTextAtSize(cur, size) > max) {
          let i = cur.length - 1;
          while (i > 1 && font.widthOfTextAtSize(cur.slice(0, i), size) > max) i--;
          out.push(cur.slice(0, i));
          cur = cur.slice(i);
        }
      }
      out.push(cur);
    }
    return out;
  }
  function text(s: string, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; max?: number; gap?: number } = {}) {
    const font = o.font ?? F.r, size = o.size ?? 10.5, lh = size * 1.42;
    for (const line of lines(s, font, size, o.max ?? WIDTH)) {
      ensure(lh);
      page.drawText(line, { x: o.x ?? M.x, y: y - size, size, font, color: o.color ?? C.ink });
      y -= lh;
    }
    y -= o.gap ?? 0;
  }
  const label = (s: string) => { ensure(44); y -= 11; text(s.toUpperCase(), { font: F.b, size: 7.8, color: C.ink3, gap: 3 }); };
  const rule = () => { page.drawLine({ start: { x: M.x, y }, end: { x: A4.w - M.x, y }, thickness: 0.7, color: C.line }); y -= 2; };
  /** Tableau clé / valeur sur deux colonnes. */
  function rows(items: [string, string][]) {
    for (const [k, v] of items) {
      const vl = lines(v, F.r, 10.2, WIDTH - 150);
      ensure(vl.length * 14 + 5);
      page.drawText(clean(k), { x: M.x, y: y - 10, size: 9, font: F.r, color: C.ink3 });
      vl.forEach((line, i) => page.drawText(line, { x: M.x + 150, y: y - 10.2 - i * 14, size: 10.2, font: F.r, color: C.ink }));
      y -= vl.length * 14 + 5;
    }
  }

  // En-tête
  page.drawText(LEGAL.siteName, { x: M.x, y: y - 10, size: 10, font: F.b, color: C.brand });
  const num = `N° ${r.number}`;
  page.drawText(num, { x: A4.w - M.x - F.b.widthOfTextAtSize(num, 10), y: y - 10, size: 10, font: F.b, color: C.ink });
  y -= 30;
  text(c.title, { font: F.b, size: 22, gap: 1 });
  text(`Fiche n° ${c.ref} · ${c.loan.kind === "MONEY" ? "prêt d'argent" : "prêt de matériel"} · signé le ${docDateTime(r.signedAt)} (heure de Paris)`, { size: 9.5, color: C.ink3, gap: 10 });
  rule();

  // Parties, sur deux colonnes
  y -= 12;
  const col = WIDTH / 2 - 10;
  const top = y;
  const party = (x: number, title: string, items: [string, PDFFont, ReturnType<typeof rgb>][]) => {
    let yy = top;
    page.drawText(title, { x, y: yy - 8, size: 7.8, font: F.b, color: C.ink3 });
    yy -= 19;
    for (const [s, font, color] of items) {
      for (const line of lines(s, font, 10.2, col)) { page.drawText(line, { x, y: yy - 10.2, size: 10.2, font, color }); yy -= 14; }
    }
    return yy;
  };
  const leftEnd = party(M.x, "PRÊTEUR", [
    ...(c.lender.organization ? [[c.lender.organization, F.b, C.ink] as [string, PDFFont, ReturnType<typeof rgb>], [`représenté(e) par ${c.lender.name}`, F.r, C.ink2] as [string, PDFFont, ReturnType<typeof rgb>]] : [[c.lender.name, F.b, C.ink] as [string, PDFFont, ReturnType<typeof rgb>]]),
    [c.lender.email, F.r, C.ink2],
  ]);
  const rightEnd = party(M.x + WIDTH / 2 + 10, "EMPRUNTEUR", [
    [c.borrower.name, F.b, C.ink],
    [c.borrower.email, F.r, C.ink2],
    ...(c.borrower.phone ? [[c.borrower.phone, F.r, C.ink2] as [string, PDFFont, ReturnType<typeof rgb>]] : []),
  ]);
  y = Math.min(leftEnd, rightEnd) - 4;

  // Ce qui a été prêté
  const money = c.loan.kind === "MONEY" && !!c.loan.amountCents;
  label(money ? "Somme prêtée" : "Bien prêté");
  rows([
    ...(money
      ? [["Montant", `${amountInFigures(c.loan.amountCents!)} (${amountInWords(c.loan.amountCents!)})`] as [string, string],
        ...(c.loan.item && c.loan.item !== "Prêt d'argent" ? [["Motif", c.loan.item] as [string, string]] : [])]
      : [["Désignation", c.loan.item] as [string, string], ...(c.loan.description ? [["Détails", c.loan.description] as [string, string]] : [])]),
    ["Prêté le", docDay(c.loan.lentAt)],
    [money ? "À rembourser le" : "À rendre le", docDay(c.loan.dueAt)],
  ]);

  if (c.payment) {
    label("Remboursement");
    rows([
      ["Montant reçu", amountInFigures(c.payment.amountCents)],
      ["Déjà remboursé avant", amountInFigures(c.payment.repaidBeforeCents)],
      ["Total remboursé", amountInFigures(c.payment.repaidAfterCents)],
      ["Reste dû", amountInFigures(c.payment.remainingCents)],
      ...(c.payment.note ? [["Précision", c.payment.note] as [string, string]] : []),
    ]);
  }
  if (r.kind !== "LOAN") {
    rows([["Accusé de réception", c.ackNumber ? `n° ${c.ackNumber}` : "non signé par l'emprunteur"]]);
  }

  label("Déclaration");
  for (const p of c.statement) text(p, { size: 10.6, gap: 4 });

  if (c.mention) {
    label("Somme écrite par l'emprunteur");
    rows([["En lettres", `« ${c.mention.words} »`], ["En chiffres", `« ${c.mention.figures} »`]]);
  }

  // Signature
  label("Signature");
  const boxW = 236, boxH = 80;
  ensure(boxH + 10);
  const boxTop = y;
  page.drawRectangle({ x: M.x, y: boxTop - boxH, width: boxW, height: boxH, color: C.soft, borderColor: C.line, borderWidth: 0.7 });
  if (isDrawn(r.signature)) {
    const s = r.signature;
    const scale = Math.min((boxW - 16) / s.w, (boxH - 12) / s.h);
    const ox = M.x + (boxW - s.w * scale) / 2, oy = boxTop - (boxH - s.h * scale) / 2;
    page.drawSvgPath(signaturePath(s), { x: ox, y: oy, scale, borderColor: C.ink, borderWidth: 3.4, borderLineCap: LineCapStyle.Round });
  } else {
    const name = clean(r.signerName);
    const size = Math.min(20, (boxW - 24) / Math.max(1, F.b.widthOfTextAtSize(name, 1)));
    page.drawText(name, { x: M.x + 12, y: boxTop - boxH / 2 - size / 3, size, font: F.b, color: C.ink });
    page.drawText("signature saisie au clavier", { x: M.x + 12, y: boxTop - boxH + 9, size: 7.5, font: F.r, color: C.ink3 });
  }
  const sx = M.x + boxW + 18, sw = WIDTH - boxW - 18;
  let sy = boxTop;
  for (const [s, font, size, color] of [
    ["Signé électroniquement par", F.r, 9.2, C.ink3],
    [r.signerName, F.b, 12, C.ink],
    [`le ${docDateTime(r.signedAt)}`, F.r, 10, C.ink2],
    ["(heure de Paris)", F.r, 9.2, C.ink3],
  ] as [string, PDFFont, number, ReturnType<typeof rgb>][]) {
    for (const line of lines(s, font, size, sw)) { page.drawText(line, { x: sx, y: sy - size, size, font, color }); sy -= size * 1.45; }
  }
  y = Math.min(boxTop - boxH, sy) - 4;

  // Éléments de preuve
  label("Éléments de preuve");
  const proof = [
    r.kind === "LOAN"
      ? `Signataire identifié par le lien personnel envoyé à ${r.signerEmail}.`
      : `Signé depuis le compte ${LEGAL.siteName} ${r.signerEmail}, protégé par mot de passe.`,
    `Adresse IP : ${r.ip ?? "non disponible"}`,
    `Navigateur : ${(r.userAgent ?? "non disponible").slice(0, 160)}`,
    `Empreinte SHA-256 du document : ${r.hash}`,
  ];
  ensure(proof.length * 13 + 8);
  for (const p of proof) text(p, { size: 8.4, color: C.ink2, gap: 1 });

  // Pied de page sur chaque page
  const pages = doc.getPages();
  const foot = [
    "À imprimer et à conserver. " + LEGAL.siteName + " n'archive pas ce document : en cas de suppression du prêt ou du compte, d'arrêt du service ou d'incident technique, cette copie peut être votre seule preuve.",
    "Signature électronique simple (articles 1366 et 1367 du Code civil ; règlement (UE) n° 910/2014, dit eIDAS).",
  ];
  pages.forEach((p, i) => {
    let fy = M.bottom - 18;
    p.drawLine({ start: { x: M.x, y: fy + 6 }, end: { x: A4.w - M.x, y: fy + 6 }, thickness: 0.6, color: C.line });
    for (const line of foot.flatMap((s) => lines(s, F.r, 7.4, WIDTH - 96))) {
      p.drawText(line, { x: M.x, y: fy - 4, size: 7.4, font: F.r, color: C.ink3 });
      fy -= 10;
    }
    const pn = `${r.number} · ${i + 1}/${pages.length}`;
    p.drawText(pn, { x: A4.w - M.x - F.r.widthOfTextAtSize(pn, 7.4), y: M.bottom - 22, size: 7.4, font: F.r, color: C.ink3 });
  });

  return doc.save();
}
