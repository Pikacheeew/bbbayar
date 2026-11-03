import type { CampaignStatus } from "./types";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  open: "Open",
  closed: "Closed",
  completed: "Completed",
};

export const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, string> = {
  open: "bg-green-100 text-green-700",
  closed: "bg-zinc-700 text-zinc-100",
  completed: "bg-violet-100 text-violet-700",
};
