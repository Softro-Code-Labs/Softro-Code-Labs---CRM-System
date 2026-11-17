import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { replyState } from "@/lib/working-days";
import { formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Shows a lead's status against the "reply within 2 working days" promise. */
export function ReplyBadge({ respondBy, respondedAt, compact }: { respondBy: Date | null; respondedAt: Date | null; compact?: boolean }) {
  const state = replyState({ respondBy, respondedAt });
  if (state === "none") return null;
  if (state === "replied") {
    return compact ? null : (
      <Badge tone="green" className="gap-1">
        <CheckCircle2 className="size-3" aria-hidden /> Replied
      </Badge>
    );
  }
  if (state === "overdue") {
    return (
      <Badge tone="red" className="gap-1" title={`Reply was due ${respondBy?.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}`}>
        <AlertTriangle className="size-3" aria-hidden /> Reply overdue
      </Badge>
    );
  }
  return (
    <Badge tone={state === "due-soon" ? "amber" : "gray"} className="gap-1">
      <Clock className="size-3" aria-hidden /> Reply {formatRelative(respondBy!)}
    </Badge>
  );
}
