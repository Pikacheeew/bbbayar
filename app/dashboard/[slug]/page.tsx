import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/money";
import type { CampaignItemTotal, CampaignPublic, DiscountTier, Participant } from "@/lib/types";
import ForceCloseButton from "./ForceCloseButton";
import ShareLinkActions from "./ShareLinkActions";
import AddParticipantForm from "./AddParticipantForm";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import ProgressBar from "@/components/ProgressBar";
import Stat from "@/components/Stat";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SHIPPING_LABEL } from "@/lib/fees";
import { PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLES } from "@/lib/participant-status";

export default async function OrganizerCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { slug } = await params;
  const { created } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: campaign, error: campaignError } = await supabase.rpc(
    "get_campaign_public",
    { p_slug: slug }
  );

  if (campaignError || !campaign) {
    notFound();
  }

  const c = campaign as CampaignPublic;
  const isSell = c.campaign_type === "sell";
  const hasStockCap = isSell && c.max_qty != null;

  const { data: participants, error: participantsError } = await supabase.rpc(
    "list_participants",
    { p_campaign_id: c.id }
  );

  if (participantsError) {
    redirect("/dashboard");
  }

  const tiers = isSell
    ? ((await supabase.rpc("get_discount_tiers", { p_campaign_id: c.id })).data as
        | DiscountTier[]
        | null) ?? []
    : [];

  const itemTotals = isSell
    ? ((await supabase.rpc("get_campaign_item_totals", { p_campaign_id: c.id })).data as
        | CampaignItemTotal[]
        | null) ?? []
    : [];
  const hasItems = itemTotals.length > 0;

  const joinUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/c/${c.slug}`;
  const participantList = (participants as Participant[] | null) ?? [];
  const withShipping = participantList.filter((p) => p.shipping_method);
  const hasPaid = participantList.some((p) => p.status === "paid");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to dashboard
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{c.title}</h1>
        <div className="flex items-center gap-2">
          {!hasPaid && (
            <Link
              href={`/dashboard/${c.slug}/edit`}
              className="text-sm text-blue-600 hover:underline"
            >
              Edit
            </Link>
          )}
          {c.status !== "open" && (
            <Link
              href={`/dashboard/${c.slug}/report`}
              className="text-sm text-blue-600 hover:underline"
            >
              Report
            </Link>
          )}
          <CampaignStatusBadge status={c.status} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {c.campaign_type === "pledge" ? "Pledge" : "Bulk Sell"} campaign
        {isSell && tiers.length > 0 ? " · quantity discount" : ""}
        {hasStockCap ? " · limited stock" : ""}
        {isSell && !c.requires_shipping ? " · pickup only" : ""}
      </p>

      {created === "1" && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          🎉 Your group buy is live — the link&apos;s already copied to your clipboard, ready to paste.
        </div>
      )}

      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Share this link to invite people</p>
          <Link
            href={`/c/${c.slug}`}
            target="_blank"
            className="text-sm text-blue-600 hover:underline"
          >
            View public page ↗
          </Link>
        </div>
        <Input readOnly value={joinUrl} className="mt-1 bg-muted" />
        <ShareLinkActions joinUrl={joinUrl} title={c.title} />
      </Card>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:gap-4">
        {c.campaign_type === "pledge" ? (
          <>
            <Stat label="Total price" value={formatIDR(c.total_amount ?? 0)} />
            <Stat label="Deadline" value={new Date(c.deadline).toLocaleString("id-ID")} />
          </>
        ) : (
          <>
            {hasItems ? (
              <Stat label="Menu" value={`${itemTotals.length} item${itemTotals.length === 1 ? "" : "s"}`} />
            ) : (
              <Stat label="Price / unit" value={formatIDR(c.base_price ?? 0)} />
            )}
            {hasStockCap ? (
              <Stat label="Stock" value={`${c.slots_taken} / ${c.max_qty ?? 0} claimed`} />
            ) : (
              <Stat label="Deadline" value={new Date(c.deadline).toLocaleString("id-ID")} />
            )}
          </>
        )}
        <Stat label="Joined" value={`${c.slots_taken}`} />
        <Stat label="Collected" value={`${formatIDR(c.total_collected)} (${c.paid_count} paid)`} />
        {isSell && c.origin_address && (
          <Stat
            label="Ships from"
            value={`${c.origin_address}, ${c.origin_city} ${c.origin_postal_code}`}
          />
        )}
      </dl>

      {isSell && c.location_url && (
        <a
          href={c.location_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          View on Google Maps ↗
        </a>
      )}

      {isSell && tiers.length > 0 && (
        <Card className="mt-3 p-3 text-sm">
          <p className="font-medium text-foreground">Discount tiers</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {tiers.map((t) => (
              <li key={t.id} className={t.min_buyers <= c.slots_taken ? "font-medium text-emerald-600" : ""}>
                {t.min_buyers}+ buyers → {t.discount_percent}% off
                {t.min_buyers <= c.slots_taken ? " ✓ active" : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasItems && (
        <Card className="mt-3 p-3 text-sm">
          <p className="font-medium text-foreground">Order recap — what to prepare</p>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Item</th>
                <th className="py-1 pr-2">Qty ordered</th>
                <th className="py-1">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itemTotals.map((it) => (
                <tr key={it.item_name}>
                  <td className="py-1.5 pr-2 text-foreground">{it.item_name}</td>
                  <td className="py-1.5 pr-2 font-medium text-foreground">{it.total_qty}</td>
                  <td className="py-1.5 text-muted-foreground">{formatIDR(it.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {c.status === "open" && !hasStockCap ? (
        <div className="mt-4">
          <ForceCloseButton campaignId={c.id} />
        </div>
      ) : (
        <div className="mt-4">
          <ProgressBar
            percent={c.slots_taken > 0 ? (c.paid_count / c.slots_taken) * 100 : 0}
            label={`${c.paid_count} / ${c.slots_taken} paid`}
          />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Participants</h2>
        <AddParticipantForm campaignId={c.id} />
      </div>
      <Card className="mt-2 overflow-x-auto py-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              {hasItems && <th className="px-3 py-2">Order</th>}
              <th className="px-3 py-2">Total due</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {participantList.map((p) => {
              const total =
                p.amount_due != null ? p.amount_due + p.shipping_fee + p.admin_fee : null;
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.name}
                    {p.is_organizer && (
                      <span className="ml-1 text-xs text-muted-foreground">(organizer)</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{p.phone}</td>
                  {hasItems && (
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.order_summary ?? "—"}
                      {p.notes && <span className="block text-xs italic">“{p.notes}”</span>}
                    </td>
                  )}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {total != null ? formatIDR(total) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={`border-transparent ${PARTICIPANT_STATUS_STYLES[p.status]}`}>
                      {PARTICIPANT_STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {isSell && c.requires_shipping && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-foreground">Shipping addresses</h2>
          {withShipping.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No one has confirmed a delivery address yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {withShipping.map((p) => (
                <li key={p.id}>
                  <Card className="p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{p.name}</p>
                      <Badge className="border-transparent bg-blue-100 text-blue-700">
                        {SHIPPING_LABEL[p.shipping_method!]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{p.phone}</p>
                    <p className="mt-1 text-foreground">
                      {p.shipping_address}, {p.shipping_city} {p.shipping_postal_code}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

