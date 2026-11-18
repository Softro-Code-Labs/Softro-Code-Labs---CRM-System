import Link from "next/link";
import type { ReactNode } from "react";
import { balanceDue, invoiceState } from "@/lib/invoices";
import { INVOICE_STATE_LABELS, INVOICE_STATE_TONE } from "@/lib/crm-meta";
import { formatDate, formatMoney, formatMoneyTotals } from "@/lib/utils";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const invoiceCardSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  currency: true,
  issueDate: true,
  dueDate: true,
  total: true,
  amountPaid: true,
} as const;

type Row = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  issueDate: Date;
  dueDate: Date | null;
  total: { toString(): string };
  amountPaid: { toString(): string };
};

/** Invoices for a deal, contract or company, with what's still owed. */
export function InvoicesCard({ invoices, action, empty = "No invoices yet." }: { invoices: Row[]; action?: ReactNode; empty?: string }) {
  const open = invoices.filter((i) => i.status === "ISSUED");
  const owed = open.length ? formatMoneyTotals(open.map((i) => ({ value: balanceDue(i), currency: i.currency }))) : null;
  return (
    <Card>
      <CardHeader title={`Invoices (${invoices.length})`} description={owed ? `${owed} still owed` : undefined} action={action} />
      {invoices.length ? (
        <ul className="divide-y divide-ink-100">
          {invoices.map((inv) => {
            const state = invoiceState(inv);
            return (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-ink-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{inv.title}</p>
                    <p className="font-mono text-xs text-ink-500">
                      {inv.number} · {formatDate(inv.issueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">{formatMoney(inv.total, inv.currency)}</span>
                    <Badge tone={INVOICE_STATE_TONE[state]}>{INVOICE_STATE_LABELS[state]}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <CardBody className="text-sm text-ink-500">{empty}</CardBody>
      )}
    </Card>
  );
}
