import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/money";
import type {
  CampaignItemTotal,
  CampaignPublic,
  OrderItemRow,
  Participant,
} from "@/lib/types";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import PrintButton from "@/components/PrintButton";
import Stat from "@/components/Stat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SHIPPING_LABEL } from "@/lib/fees";
import { PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLES } from "@/lib/participant-status";

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: campaign, error: campaignError } = await supabase.rpc("get_campaign_public", {
    p_slug: slug,
  });
  if (campaignError || !campaign) {
    notFound();
  }
  const c = campaign as CampaignPublic;
  const isSell = c.campaign_type === "sell";

  const { data: participants, error: participantsError } = await supabase.rpc(
    "list_participants",
    { p_campaign_id: c.id }
  );
  if (participantsError) {
    redirect("/dashboard");
  }
  const participantList = ((participants as Participant[] | null) ?? []).filter(
    (p) => !p.is_organizer
  );

  const ready = c.status !== "open";

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href={`/dashboard/${c.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to group buy
        </Link>
        <Card className="mt-4 p-6 text-sm text-muted-foreground">
          The report will be available once the campaign closes — either everyone has paid,
          the deadline passes, or you force-close it.
        </Card>
      </div>
    );
  }

  const itemTotals = isSell
    ? ((await supabase.rpc("get_campaign_item_totals", { p_campaign_id: c.id })).data as
        | CampaignItemTotal[]
        | null) ?? []
    : [];
  const hasItems = itemTotals.length > 0;

  const orderItems = hasItems
    ? ((await supabase.rpc("list_order_items", { p_campaign_id: c.id })).data as
        | OrderItemRow[]
        | null) ?? []
    : [];
  const orderItemsByParticipant = new Map<string, OrderItemRow[]>();
  for (const row of orderItems) {
    const list = orderItemsByParticipant.get(row.participant_id) ?? [];
    list.push(row);
    orderItemsByParticipant.set(row.participant_id, list);
  }

  const totalCollected = participantList
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount_due ?? 0) + p.shipping_fee + p.admin_fee, 0);
  const paidCount = participantList.filter((p) => p.status === "paid").length;
  const instantCount = participantList.filter((p) => p.shipping_method === "instant").length;
  const jntCount = participantList.filter((p) => p.shipping_method === "jnt").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-full print:px-0">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/${c.slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to group buy
        </Link>
        <PrintButton label="Print full report" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-foreground">{c.title} — Report</h1>
        <CampaignStatusBadge status={c.status} />
      </div>
      <p className="text-xs text-muted-foreground">
        {c.campaign_type === "pledge" ? "Pledge" : "Bulk Sell"} · closed{" "}
        {new Date(c.deadline).toLocaleString("id-ID")}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="Orders" value={`${participantList.length}`} />
        <Stat label="Paid" value={`${paidCount} / ${participantList.length}`} />
        <Stat label="Total collected" value={formatIDR(totalCollected)} />
        <Stat
          label="Ships"
          value={
            isSell
              ? c.requires_shipping
                ? `Instant ${instantCount} · JNT ${jntCount}`
                : "Pickup"
              : "—"
          }
        />
      </dl>

      {hasItems && (
        <Card className="mt-4 p-3 text-sm">
          <p className="font-medium text-foreground">SKU recap — what to prepare</p>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">Item</th>
                <th className="py-1 pr-2">Qty</th>
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

      <h2 className="mt-6 text-sm font-semibold text-foreground">Orders</h2>
      <div className="mt-2 space-y-3">
        {participantList.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders were placed.</p>
        ) : (
          participantList.map((p) => {
            const lines = orderItemsByParticipant.get(p.id) ?? [];
            const total = (p.amount_due ?? 0) + p.shipping_fee + p.admin_fee;
            return (
              <Card key={p.id} className="p-4 text-sm print:break-inside-avoid">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{p.name}</p>
                  <div className="flex items-center gap-2 print:hidden">
                    <Badge className={`border-transparent ${PARTICIPANT_STATUS_STYLES[p.status]}`}>
                      {PARTICIPANT_STATUS_LABEL[p.status]}
                    </Badge>
                    <Link
                      href={`/dashboard/${c.slug}/report/${p.id}`}
                      target="_blank"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Print slip →
                    </Link>
                  </div>
                  <span className="hidden print:inline text-xs text-muted-foreground">
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.phone}</p>

                {lines.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-muted-foreground">
                    {lines.map((line, i) => (
                      <li key={i}>
                        {line.qty}x {line.item_name} — {formatIDR(line.unit_price * line.qty)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">{formatIDR(p.amount_due ?? 0)}</p>
                )}

                {p.notes && (
                  <p className="mt-1 text-xs italic text-muted-foreground">Note: “{p.notes}”</p>
                )}

                {isSell && c.requires_shipping && p.shipping_method && (
                  <p className="mt-2 text-xs text-foreground">
                    {SHIPPING_LABEL[p.shipping_method]}: {p.shipping_address}, {p.shipping_city}{" "}
                    {p.shipping_postal_code}
                  </p>
                )}
                {isSell && !c.requires_shipping && (
                  <p className="mt-2 text-xs text-foreground">Pickup — no delivery</p>
                )}

                <p className="mt-2 text-right font-semibold text-foreground">
                  Total: {formatIDR(total)}
                </p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

