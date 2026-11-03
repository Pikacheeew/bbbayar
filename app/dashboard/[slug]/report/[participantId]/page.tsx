import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/money";
import type { CampaignPublic, OrderItemRow, Participant } from "@/lib/types";
import PrintButton from "@/components/PrintButton";
import { Card } from "@/components/ui/card";
import { SHIPPING_LABEL } from "@/lib/fees";

export default async function OrderSlipPage({
  params,
}: {
  params: Promise<{ slug: string; participantId: string }>;
}) {
  const { slug, participantId } = await params;
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
  const p = ((participants as Participant[] | null) ?? []).find((row) => row.id === participantId);
  if (!p) {
    notFound();
  }

  const orderItems = isSell
    ? ((await supabase.rpc("list_order_items", { p_campaign_id: c.id })).data as
        | OrderItemRow[]
        | null) ?? []
    : [];
  const lines = orderItems.filter((row) => row.participant_id === participantId);
  const total = (p.amount_due ?? 0) + p.shipping_fee + p.admin_fee;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/${c.slug}/report`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to report
        </Link>
        <PrintButton />
      </div>

      <Card className="mt-4 p-6">
        <p className="text-xs text-muted-foreground">{c.title}</p>
        <h1 className="mt-1 text-lg font-semibold text-foreground">{p.name}</h1>
        <p className="text-sm text-muted-foreground">{p.phone}</p>

        <div className="mt-4 border-t pt-4">
          {lines.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {lines.map((line, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-foreground">
                    {line.qty}x {line.item_name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatIDR(line.unit_price * line.qty)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-foreground">
                {c.campaign_type === "pledge" ? "Share" : "Order"}
              </span>
              <span className="text-muted-foreground">{formatIDR(p.amount_due ?? 0)}</span>
            </div>
          )}

          {p.notes && (
            <p className="mt-2 text-xs italic text-muted-foreground">Note: “{p.notes}”</p>
          )}
        </div>

        <div className="mt-4 border-t pt-4 text-sm">
          {isSell && c.requires_shipping && p.shipping_method ? (
            <>
              <p className="font-medium text-foreground">{SHIPPING_LABEL[p.shipping_method]}</p>
              <p className="text-muted-foreground">
                {p.shipping_address}, {p.shipping_city} {p.shipping_postal_code}
              </p>
            </>
          ) : isSell && !c.requires_shipping ? (
            <p className="font-medium text-foreground">Pickup — no delivery</p>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="text-sm font-medium text-foreground">Total</span>
          <span className="text-lg font-semibold text-foreground">{formatIDR(total)}</span>
        </div>
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {p.status === "paid" ? "Paid ✓" : p.status.replace("_", " ")}
        </p>
      </Card>
    </div>
  );
}
