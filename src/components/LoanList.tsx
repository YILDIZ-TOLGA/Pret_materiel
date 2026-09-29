"use client";
import Link from "next/link";
import { dateFr, dueLabel, itemEmoji } from "@/lib/client";

export type LoanDTO = {
  id: string; item: string; description: string | null; borrowerName: string; borrowerEmail: string; borrowerPhone: string | null;
  lentAt: string; dueAt: string; status: "ACTIVE" | "RETURNED"; returnedAt: string | null; autoReminder: boolean; remindBefore: boolean;
  lastReminderAt: string | null; reminderCount: number; notes: string | null; borrowerId: string | null;
  lender?: { name: string; email: string };
};

export function LoanRow({ loan, href, who }: { loan: LoanDTO; href?: string; who: string }) {
  const due = dueLabel(loan.dueAt, loan.status);
  const content = (
    <div className={`loan ${due.tone === "bad" ? "overdue" : ""}`}>
      <div className="loan-ico">{itemEmoji(loan.item)}</div>
      <div className="loan-main">
        <div className="loan-title">{loan.item}</div>
        <div className="muted small">{who} · {loan.status === "RETURNED" && loan.returnedAt ? `rendu le ${dateFr(loan.returnedAt)}` : `retour le ${dateFr(loan.dueAt)}`}</div>
      </div>
      <span className={`badge ${due.tone}`}>{due.tone === "bad" ? "⚠ " : due.tone === "good" ? "✓ " : ""}{due.text}</span>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : <div>{content}</div>;
}
