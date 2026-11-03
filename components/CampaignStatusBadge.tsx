import type { CampaignStatus, ParticipantStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_STYLES } from "@/lib/campaign-status";

export default function CampaignStatusBadge({
  status,
  myStatus,
}: {
  status: CampaignStatus;
  myStatus?: ParticipantStatus | null;
}) {
  const myStatusInfo: Record<ParticipantStatus, { label: string; style: string }> = {
    awaiting_payment: { label: "Please Pay", style: "bg-amber-100 text-amber-700" },
    paid: { label: "Joined – Paid", style: "bg-emerald-100 text-emerald-700" },
    joined: { label: "Waiting for Payment", style: "bg-blue-100 text-blue-700" },
  };

  if (myStatus && myStatusInfo[myStatus]) {
    const { label, style } = myStatusInfo[myStatus];
    return <Badge className={`shrink-0 border-transparent ${style}`}>{label}</Badge>;
  }

  return (
    <Badge className={`shrink-0 border-transparent ${CAMPAIGN_STATUS_STYLES[status]}`}>
      {CAMPAIGN_STATUS_LABEL[status]}
    </Badge>
  );
}
