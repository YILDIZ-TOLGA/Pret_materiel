/**
 * Montant en toutes lettres, pour la mention que recopie l'emprunteur d'une somme d'argent : l'acte par lequel
 * on s'engage à payer une somme ne fait preuve que s'il porte cette somme écrite par le signataire lui-même,
 * en toutes lettres et en chiffres (art. 1376 du Code civil ; sous forme électronique, art. 1174).
 * Orthographe traditionnelle (« deux cents », « deux cent un », « quatre-vingts », « vingt et un ») ; la
 * comparaison accepte aussi l'orthographe de 1990 (traits d'union partout) et les fautes d'accord courantes.
 * Utilisé par la page de signature (aide à la saisie) et par le serveur (vérification) : pas de dépendance.
 */
const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize",
  "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 à 99. `beforeMille` : « quatre-vingt mille » (pas de s devant mille). */
function below100(n: number, beforeMille = false): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10), u = n % 10;
  if (t === 7) return u === 1 ? "soixante et onze" : `soixante-${UNITS[10 + u]}`;
  if (t === 9) return `quatre-vingt-${UNITS[10 + u]}`;
  if (t === 8) return u === 0 ? (beforeMille ? "quatre-vingt" : "quatre-vingts") : `quatre-vingt-${UNITS[u]}`;
  if (u === 0) return TENS[t];
  return u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
}

/** 0 à 999. « cent » prend un s quand il est multiplié et termine le nombre, sauf devant « mille ». */
function below1000(n: number, beforeMille = false): string {
  const h = Math.floor(n / 100), r = n % 100;
  if (!h) return below100(r, beforeMille);
  const head = h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 && !beforeMille ? "s" : ""}`;
  return r ? `${head} ${below100(r, beforeMille)}` : head;
}

/** Nombre entier en lettres (jusqu'aux milliards). */
export function integerInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("Nombre entier positif attendu");
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9), millions = Math.floor((n % 1e9) / 1e6), thousands = Math.floor((n % 1e6) / 1e3), rest = n % 1e3;
  if (billions) parts.push(`${below1000(billions)} milliard${billions > 1 ? "s" : ""}`);
  if (millions) parts.push(`${below1000(millions)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands, true)} mille`);
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

/** « cinq cents euros », « un euro et cinquante centimes », « deux millions d'euros ». */
export function amountInWords(cents: number): string {
  const euros = Math.floor(cents / 100), c = cents % 100;
  const unit = euros >= 1e6 && euros % 1e6 === 0 ? "d'euros" : euros > 1 ? "euros" : "euro";
  const e = euros ? `${integerInWords(euros)} ${unit}` : "";
  const cc = c ? `${integerInWords(c)} centime${c > 1 ? "s" : ""}` : "";
  return [e, cc].filter(Boolean).join(" et ") || "zéro euro";
}

// Variantes acceptées : accords oubliés ou en trop, « € » pour « euros », « et » et « de/d' » facultatifs
const SAME: Record<string, string> = { cents: "cent", vingts: "vingt", milles: "mille", millions: "million", milliards: "milliard", euros: "euro", centimes: "centime" };
const normWords = (s: string) =>
  s.replace(/€/g, " euro ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .split(/[^a-z]+/).map((w) => SAME[w] ?? w).filter((w) => w && w !== "et" && w !== "d" && w !== "de").join(" ");

/** La somme écrite en lettres correspond-elle au montant ? */
export const sameAmountInWords = (typed: string, cents: number) => normWords(typed) !== "" && normWords(typed) === normWords(amountInWords(cents));

/** La somme écrite en chiffres correspond-elle au montant ? Accepte « 500 », « 500,00 € », « 1 500 ». */
export function sameAmountInFigures(typed: string, cents: number) {
  const s = typed.replace(/[\s  ]/g, "").replace(/€|eur(os?)?$/i, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;
  return Math.round(Number(s) * 100) === cents;
}

/** Le montant en chiffres, tel qu'on l'imprime : « 500 € », « 1 250,50 € ». */
export const amountInFigures = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).replace(/ /g, " ");
