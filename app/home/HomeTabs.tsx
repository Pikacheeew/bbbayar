"use client";

import { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/money";
import type { ParticipantDetail, ParticipantStatus, PledgeCampaign } from "@/lib/types";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import ProgressBar from "@/components/ProgressBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLES } from "@/lib/participant-status";

type Tab = "all" | "pledge" | "sell" | "payments";

const STATUS_ORDER: Record<ParticipantStatus, number> = {
  awaiting_payment: 0,
  joined: 1,
  paid: 2,
};

export default function HomeTabs({
  campaigns,
  myStatusByCampaign,
  participations,
}: {
  campaigns: PledgeCampaign[];
  myStatusByCampaign: Record<string, ParticipantStatus>;
  participations: ParticipantDetail[];
}) {
  const [tab, setTab] = useState<Tab>("all");

  const filtered =
    tab === "all" || tab === "payments" ? campaigns : campaigns.filter((c) => c.campaign_type === tab);

  const totalDue = participations
    .filter((p) => p.status === "awaiting_payment")
    .reduce((sum, p) => sum + (p.amount_due ?? 0), 0);

  const sortedParticipations = participations
    .slice()
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pledge", label: "Pledge" },
    { key: "sell", label: "Bulk Sell" },
    { key: "payments", label: totalDue > 0 ? "My Payments •" : "My Payments" },
  ];

  return (
    <div className="mt-6">
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "payments" ? (
        <div className="mt-4">
          {totalDue > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                You have <span className="font-semibold">{formatIDR(totalDue)}</span> still to pay
                across your open group buys.
              </p>
            </Card>
          )}
          {sortedParticipations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You haven&apos;t joined any group buys yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {sortedParticipations.map((p) => (
                <li key={p.id}>
                  <Link href={`/c/${p.campaign_slug}/p/${p.id}`}>
                    <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {p.campaign_title}
                          {p.is_organizer && (
                            <span className="ml-1 text-xs text-muted-foreground">(organizer)</span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {p.amount_due != null ? formatIDR(p.amount_due) : "Amount pending"}
                        </p>
                      </div>
                      <Badge
                        className={`shrink-0 whitespace-nowrap border-transparent ${PARTICIPANT_STATUS_STYLES[p.status]}`}
                      >
                        {PARTICIPANT_STATUS_LABEL[p.status]}
                      </Badge>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {tab === "all" ? "No group buys yet — be the first to start one." : "No campaigns of this type yet."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((c) => (
            <PledgeCard key={c.id} campaign={c} myStatus={myStatusByCampaign[c.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function PledgeCard({
  campaign: c,
  myStatus,
}: {
  campaign: PledgeCampaign;
  myStatus: ParticipantStatus | null;
}) {
  const isPledge = c.campaign_type === "pledge";
  const hasStockCap = c.campaign_type === "sell" && c.max_qty != null;
  const perPerson =
    isPledge && c.total_amount
      ? c.slots_taken > 0
        ? Math.ceil(c.total_amount / c.slots_taken)
        : c.total_amount
      : c.base_price ?? 0;

  return (
    <Link href={`/c/${c.slug}`}>
      <Card className="h-full overflow-hidden p-4 transition-colors hover:bg-muted/50">
        {c.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image_url}
            alt={c.title}
            className="-mx-4 -mt-4 mb-3 h-32 w-[calc(100%+2rem)] object-cover"
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium text-foreground text-balance">{c.title}</h2>
          <CampaignStatusBadge status={c.status} myStatus={myStatus} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">by {c.organizer_name ?? "Unknown"}</p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-lg font-semibold text-foreground">
            {formatIDR(perPerson)}
          </span>
          <span className="text-xs text-muted-foreground">
            {isPledge ? "/ person right now" : "/ unit"}
          </span>
        </div>
        {isPledge && (
          <p className="text-xs text-muted-foreground">Total {formatIDR(c.total_amount ?? 0)}</p>
        )}

        <div className="mt-3 text-xs text-muted-foreground">
          {hasStockCap ? (
            <span>
              {Math.max((c.max_qty ?? 0) - c.slots_taken, 0)} / {c.max_qty ?? 0} left
            </span>
          ) : c.status === "open" ? (
            <span>{c.slots_taken} joined · closes {new Date(c.deadline).toLocaleDateString("id-ID")}</span>
          ) : (
            <div>
              <ProgressBar
                percent={c.slots_taken > 0 ? (c.paid_count / c.slots_taken) * 100 : 0}
                label={`${c.paid_count} / ${c.slots_taken} paid`}
              />
              <p className="mt-1">{formatIDR(c.total_collected)} collected</p>
            </div>
          )}
        </div>

        <span className="mt-3 inline-block text-sm font-medium text-foreground">
          {myStatus === "awaiting_payment"
            ? "Pay now →"
            : c.status === "open" && myStatus === null
            ? hasStockCap
              ? "Grab it →"
              : "Join →"
            : "View →"}
        </span>
      </Card>
    </Link>
  );
}
