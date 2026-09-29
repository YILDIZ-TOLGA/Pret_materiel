import nodemailer from "nodemailer";
import { prisma } from "./db";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,sans-serif;color:#1a1a19">
<div style="max-width:520px;margin:24px auto;background:#fff;border-radius:12px;padding:28px">
<h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>
${paragraphs.map((p) => `<p style="line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("")}
${cta ? `<p style="margin:20px 0 0"><a href="${cta.url}" style="background:#2a78d6;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(cta.label)}</a></p>` : ""}
<p style="color:#8a8983;font-size:12px;margin-top:28px">Envoyé par Prêt Matériel</p>
</div></body></html>`;
}

export async function sendMail(opts: { to: string; subject: string; kind: string; title: string; paragraphs: string[]; cta?: { label: string; url: string } }) {
  const html = layout(opts.title, opts.paragraphs, opts.cta);
  const text = [opts.title, ...opts.paragraphs, opts.cta ? `${opts.cta.label} : ${opts.cta.url}` : ""].join("\n\n");
  let ok = true;
  let err: string | undefined;
  try {
    if (transporter) {
      await transporter.sendMail({ from: process.env.MAIL_FROM, to: opts.to, subject: opts.subject, html, text });
    } else {
      console.log(`\n📧 [mail non configuré] À: ${opts.to}\nSujet: ${opts.subject}\n${text}\n`);
    }
  } catch (e) {
    ok = false;
    err = e instanceof Error ? e.message : String(e);
    console.error("Échec envoi mail", err);
  }
  await prisma.emailLog.create({ data: { to: opts.to, subject: opts.subject, kind: opts.kind, ok, error: err } });
  return ok;
}
