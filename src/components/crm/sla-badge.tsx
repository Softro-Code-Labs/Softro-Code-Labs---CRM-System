import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { TicketStatus } from "@/generated/prisma/enums";
import { slaState } from "@/lib/tickets";
import { formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** First-response SLA for a ticket. */
export function SlaBadge({ ticket, compact }: { ticket: { status: TicketStatus; responseDueAt: Date | null; firstResponseAt: Date | null }; compact?: boolean }) {
  const state = slaState(ticket);
  if (state === "none") return null;
  if (state === "met") return compact ? null : <Badge tone="green" className="gap-1"><CheckCircle2 className="size-3" aria-hidden /> Replied on time</Badge>;
  if (state === "late-reply") return compact ? null : <Badge tone="gray">Replied late</Badge>;
  if (state === "overdue") return <Badge tone="red" className="gap-1"><AlertTriangle className="size-3" aria-hidden /> Reply overdue</Badge>;
  return (
    <Badge tone={state === "due-soon" ? "amber" : "gray"} className="gap-1">
      <Clock className="size-3" aria-hidden /> Reply {formatRelative(ticket.responseDueAt!)}
    </Badge>
  );
}
