import nodemailer from "nodemailer";
import { prisma } from "./db";
import { MAIL_LIMITS } from "./limits";
import { isOptedOut, optOutApiUrl, optOutUrl } from "./optout";

const DAY = 86400000;

/** Nombre d'e-mails partis vers cette adresse (tiers) sur les dernières 24 h. */
export const thirdPartyMailsToday = (to: string) =>
  prisma.emailLog.count({ where: { to: to.toLowerCase(), thirdParty: true, ok: true, createdAt: { gt: new Date(Date.now() - DAY) } } });

/**
 * Deux façons d'envoyer :
 *  - API web de Brevo (BREVO_API_KEY), en HTTPS : à utiliser quand l'hébergeur bloque le SMTP sortant
 *    (Railway le bloque sur les offres Free, Trial et Hobby) ;
 *  - SMTP (SMTP_HOST…), par exemple Mailpit en local ou un relais SMTP chez un hébergeur qui l'autorise.
 * L'API est prioritaire si sa clé est présente.
 */
const brevoKey = () => process.env.BREVO_API_KEY;

/** « Prêt Matériel <no-reply@exemple.fr> » → { name, email } */
export function parseFrom(from: string) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: from.trim() };
}

type Attachment = { filename: string; content: string | Uint8Array; contentType: string };
const base64 = (c: string | Uint8Array) => (typeof c === "string" ? Buffer.from(c, "utf8") : Buffer.from(c)).toString("base64");

async function sendWithBrevoApi(msg: { to: string; subject: string; html: string; text: string; headers?: Record<string, string>; attachments?: Attachment[] }) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey()!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseFrom(process.env.MAIL_FROM || ""),
      to: [{ email: msg.to }],
      subject: msg.subject,
      htmlContent: msg.html,
      textContent: msg.text,
      ...(msg.headers ? { headers: msg.headers } : {}),
      ...(msg.attachments?.length
        ? { attachment: msg.attachments.map((a) => ({ name: a.filename, content: base64(a.content) })) }
        : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`API Brevo ${res.status} : ${(await res.text()).slice(0, 300)}`);
}

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

const appUrl = () => process.env.APP_URL || "http://localhost:3000";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Footer = { text: string; links: { label: string; url: string }[] };

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }, footer?: Footer) {
  const links = footer?.links.map((l) => `<a href="${l.url}" style="color:#78716c">${esc(l.label)}</a>`).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#1c1917">
<div style="max-width:520px;margin:24px auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:32px">
<h2 style="margin:0 0 16px;font-size:18px;font-weight:600">${esc(title)}</h2>
${paragraphs.map((p) => `<p style="line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("")}
${cta ? `<p style="margin:20px 0 0"><a href="${cta.url}" style="background:#1c1917;color:#fafaf9;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` : ""}
<div style="color:#78716c;font-size:12px;line-height:1.5;margin-top:28px;border-top:1px solid #e7e5e4;padding-top:16px">
<p style="margin:0 0 6px">${footer ? esc(footer.text) : "Envoyé par Prêt Matériel"}</p>
${links ? `<p style="margin:0">${links}</p>` : ""}
</div>
</div></body></html>`;
}

/**
 * Envoie un e-mail et le journalise.
 * `thirdParty` : destinataire qui n'a pas forcément de compte (emprunteur). On respecte alors sa
 * désinscription et le plafond d'envois par jour, et on ajoute l'information RGPD (art. 14) + un lien
 * de désinscription en 1 clic.
 */
export async function sendMail(opts: { to: string; subject: string; kind: string; title: string; paragraphs: string[]; cta?: { label: string; url: string }; thirdParty?: { lenderName: string; lenderId: string; organization?: string | null };
  attachments?: Attachment[] }) {
  const to = opts.to.toLowerCase();
  const log = (ok: boolean, error?: string) => prisma.emailLog.create({
    data: { to, subject: opts.subject, kind: opts.kind, ok, error, thirdParty: !!opts.thirdParty, senderId: opts.thirdParty?.lenderId },
  });
  if (opts.thirdParty) {
    const refused = (await isOptedOut(to)) ? "Destinataire désinscrit"
      : (await thirdPartyMailsToday(to)) >= MAIL_LIMITS.perRecipientPerDay ? "Plafond d'envois du jour atteint pour ce destinataire" : null;
    if (refused) {
      await log(false, refused);
      return false;
    }
  }

  const footer: Footer | undefined = opts.thirdParty
    ? {
        // Information de l'emprunteur (art. 14 RGPD) : la structure cliente est responsable du traitement.
        text: opts.thirdParty.organization
          ? `Vous recevez cet e-mail car ${opts.thirdParty.organization} (${opts.thirdParty.lenderName}) a enregistré sur Prêt Matériel un prêt à votre nom, avec votre nom et votre adresse e-mail. ${opts.thirdParty.organization} est responsable du traitement de ces données, que Prêt Matériel traite pour son compte uniquement pour l'accusé de réception à signer, les reçus et les rappels liés à ce prêt. Pour exercer vos droits, adressez-vous à ${opts.thirdParty.organization} ou écrivez-nous.`
          : `Vous recevez cet e-mail car ${opts.thirdParty.lenderName} a enregistré sur Prêt Matériel un prêt à votre nom, avec votre nom et votre adresse e-mail. Ces données servent uniquement à l'accusé de réception à signer, aux reçus et aux rappels liés à ce prêt.`,
        links: [
          { label: "Ne plus recevoir ces e-mails", url: optOutUrl(to) },
          { label: "Politique de confidentialité", url: `${appUrl()}/confidentialite` },
        ],
      }
    : { text: "Envoyé par Prêt Matériel", links: [{ label: "Politique de confidentialité", url: `${appUrl()}/confidentialite` }] };

  const html = layout(opts.title, opts.paragraphs, opts.cta, footer);
  const text = [
    opts.title, ...opts.paragraphs, opts.cta ? `${opts.cta.label} : ${opts.cta.url}` : "",
    "—", footer.text, ...footer.links.map((l) => `${l.label} : ${l.url}`),
  ].join("\n\n");
  // Désinscription en un clic depuis le client mail (RFC 8058, exigé par Gmail et Yahoo)
  const headers = opts.thirdParty
    ? { "List-Unsubscribe": `<${optOutApiUrl(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;

  let ok = true;
  let err: string | undefined;
  try {
    if (brevoKey()) {
      await sendWithBrevoApi({ to, subject: opts.subject, html, text, headers, attachments: opts.attachments });
    } else if (transporter) {
      await transporter.sendMail({
        from: process.env.MAIL_FROM, to, subject: opts.subject, html, text, headers,
        attachments: opts.attachments?.map((a) => ({ ...a, content: typeof a.content === "string" ? a.content : Buffer.from(a.content) })),
      });
    } else {
      const joined = opts.attachments?.length ? `\nPièces jointes : ${opts.attachments.map((a) => a.filename).join(", ")}` : "";
      console.log(`\n[mail non configuré] À: ${to}\nSujet: ${opts.subject}\n${text}${joined}\n`);
    }
  } catch (e) {
    ok = false;
    err = e instanceof Error ? e.message : String(e);
    console.error("Échec envoi mail", err);
  }
  await log(ok, err);
  return ok;
}
