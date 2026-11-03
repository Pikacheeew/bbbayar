import type { ParticipantStatus } from "./types";

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  joined: "Waiting for Payment",
  awaiting_payment: "Please Pay",
  paid: "Paid",
};

export const PARTICIPANT_STATUS_STYLES: Record<ParticipantStatus, string> = {
  joined: "bg-blue-100 text-blue-700",
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
};
