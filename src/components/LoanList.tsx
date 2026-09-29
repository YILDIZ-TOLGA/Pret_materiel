"use client";
import Link from "next/link";
import { dateFr, dueLabel, euros, isMoney, loanEmoji, loanTitle, remainingCents } from "@/lib/client";

export type RepaymentDTO = { id: string; amountCents: number; note: string | null; createdAt: string };

export type LoanDTO = {
  id: string; kind: "OBJECT" | "MONEY"; amountCents: number | null; repaidCents: number; repayments?: RepaymentDTO[]; item: string; description: string | null; borrowerName: string; borrowerEmail: string; borrowerPhone: string | null;
  lentAt: string; dueAt: string; status: "ACTIVE" | "RETURNED"; returnedAt: string | null; autoReminder: boolean; remindBefore: boolean;
  lastReminderAt: string | null; reminderCount: number; notes: string | null; borrowerId: string | null;
  lender?: { name: string; email: string };
};

export function LoanRow({ loan, href, who }: { loan: LoanDTO; href?: string; who: string }) {
  const due = dueLabel(loan.dueAt, loan.status, loan.kind);
  const content = (
    <div className={`loan ${due.tone === "bad" ? "overdue" : ""}`}>
      <div className="loan-ico">{loanEmoji(loan)}</div>
      <div className="loan-main">
        <div className="loan-title">{loanTitle(loan)}</div>
        <div className="muted small">
          {who} · {loan.status === "RETURNED" && loan.returnedAt ? `${isMoney(loan) ? "remboursé" : "rendu"} le ${dateFr(loan.returnedAt)}` : `retour le ${dateFr(loan.dueAt)}`}
          {isMoney(loan) && loan.status === "ACTIVE" && loan.repaidCents > 0 && ` · reste ${euros(remainingCents(loan))}`}
        </div>
      </div>
      <span className={`badge ${due.tone}`}>{due.tone === "bad" ? "⚠ " : due.tone === "good" ? "✓ " : ""}{due.text}</span>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : <div>{content}</div>;
}
