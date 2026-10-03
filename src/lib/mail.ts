import nodemailer from "nodemailer";
import { prisma } from "./db";
import { isOptedOut, optOutToken, optOutUrl } from "./optout";

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
 * désinscription, et on ajoute l'information RGPD (art. 14) + un lien de désinscription en 1 clic.
 */
export async function sendMail(opts: { to: string; subject: string; kind: string; title: string; paragraphs: string[]; cta?: { label: string; url: string }; thirdParty?: { lenderName: string } }) {
  const to = opts.to.toLowerCase();
  if (opts.thirdParty && (await isOptedOut(to))) {
    await prisma.emailLog.create({ data: { to, subject: opts.subject, kind: opts.kind, ok: false, error: "Destinataire désinscrit" } });
    return false;
  }

  const footer: Footer | undefined = opts.thirdParty
    ? {
        text: `Vous recevez cet e-mail car ${opts.thirdParty.lenderName} a enregistré sur Prêt Matériel un prêt à votre nom, avec votre nom et votre adresse e-mail. Ces données servent uniquement à vous envoyer les rappels liés à ce prêt.`,
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
    ? { "List-Unsubscribe": `<${appUrl()}/api/optout?e=${encodeURIComponent(to)}&t=${optOutToken(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;

  let ok = true;
  let err: string | undefined;
  try {
    if (transporter) {
      await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject: opts.subject, html, text, headers });
    } else {
      console.log(`\n[mail non configuré] À: ${to}\nSujet: ${opts.subject}\n${text}\n`);
    }
  } catch (e) {
    ok = false;
    err = e instanceof Error ? e.message : String(e);
    console.error("Échec envoi mail", err);
  }
  await prisma.emailLog.create({ data: { to, subject: opts.subject, kind: opts.kind, ok, error: err } });
  return ok;
}
