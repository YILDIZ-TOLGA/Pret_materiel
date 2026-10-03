"use client";
import Link from "next/link";
import { dueInfo, euros, isMoney, loanTitle, remainingCents } from "@/lib/client";
import { Icon } from "./Icon";

export type RepaymentDTO = { id: string; amountCents: number; note: string | null; createdAt: string };

export type LoanDTO = {
  id: string; kind: "OBJECT" | "MONEY"; amountCents: number | null; repaidCents: number; repayments?: RepaymentDTO[]; item: string; description: string | null; borrowerName: string; borrowerEmail: string; borrowerPhone: string | null;
  lentAt: string; dueAt: string; status: "ACTIVE" | "RETURNED"; returnedAt: string | null; autoReminder: boolean; remindBefore: boolean;
  lastReminderAt: string | null; reminderCount: number; notes: string | null; borrowerId: string | null;
  lender?: { name: string; email: string };
};

export function LoanIcon({ loan, size = 18 }: { loan: Pick<LoanDTO, "kind" | "amountCents" | "item">; size?: number }) {
  return <Icon name={isMoney(loan) ? "banknote" : "box"} size={size} />;
}

/**
 * Ligne de prêt. Toute la ligne est cliquable (lien étiré) ; les actions rapides apparaissent
 * au survol à la place de l'échéance, sans imbriquer de boutons dans un lien.
 */
export function LoanRow({ loan, href, who, actions, index = 0, leaving }: {
  loan: LoanDTO; href?: string; who: React.ReactNode; actions?: React.ReactNode; index?: number; leaving?: boolean;
}) {
  const d = dueInfo(loan);
  const money = isMoney(loan);
  const cls = ["lrow", d.tone === "late" && "late", loan.status === "RETURNED" && "done", actions && "has-actions", leaving && "out"].filter(Boolean).join(" ");
  return (
    <div className={cls} style={{ "--i": Math.min(index, 12) } as React.CSSProperties}>
      <div className="lrow-glyph"><LoanIcon loan={loan} /></div>
      <div className="lrow-main">
        {href ? <Link href={href} className="lrow-title stretched">{loanTitle(loan)}</Link> : <span className="lrow-title">{loanTitle(loan)}</span>}
        <div className="lrow-meta">{who}</div>
      </div>
      <div className="lrow-side">
        {money && loan.status === "ACTIVE" && loan.repaidCents > 0 && <span className="lrow-amt">reste {euros(remainingCents(loan))}</span>}
        <span className={`due ${d.tone}`} title={d.long}>{d.short}</span>
      </div>
      {actions && <div className="lrow-actions">{actions}</div>}
    </div>
  );
}
