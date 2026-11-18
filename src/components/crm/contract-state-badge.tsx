import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ContractStatus } from "@/generated/prisma/enums";
import { contractState, daysUntil } from "@/lib/contracts";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONE } from "@/lib/crm-meta";
import { Badge } from "@/components/ui/badge";

export function ContractStateBadge({ contract }: { contract: { status: ContractStatus; endDate: Date | null; renewalNoticeDays: number } }) {
  const state = contractState(contract);
  if (state === "renew-soon") {
    const days = daysUntil(contract.endDate!);
    return (
      <Badge tone="amber" className="gap-1">
        <RefreshCw className="size-3" aria-hidden /> Ends in {days} {days === 1 ? "day" : "days"}
      </Badge>
    );
  }
  if (state === "past-end") {
    return (
      <Badge tone="red" className="gap-1">
        <AlertTriangle className="size-3" aria-hidden /> Past end date
      </Badge>
    );
  }
  return <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>{CONTRACT_STATUS_LABELS[contract.status]}</Badge>;
}
