import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CampaignItem, CampaignPublic, DiscountTier, Participant } from "@/lib/types";
import EditCampaignForm from "./EditCampaignForm";

export default async function EditCampaignPage({
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

  const { data: participants, error: participantsError } = await supabase.rpc(
    "list_participants",
    { p_campaign_id: c.id }
  );
  if (participantsError) {
    redirect("/dashboard");
  }
  const participantList = (participants as Participant[] | null) ?? [];
  if (participantList.some((p) => p.status === "paid")) {
    redirect(`/dashboard/${slug}`);
  }

  const tiers =
    c.campaign_type === "sell"
      ? ((await supabase.rpc("get_discount_tiers", { p_campaign_id: c.id })).data as
          | DiscountTier[]
          | null) ?? []
      : [];

  const items =
    c.campaign_type === "sell"
      ? ((await supabase.rpc("get_campaign_items", { p_campaign_id: c.id })).data as
          | CampaignItem[]
          | null) ?? []
      : [];

  return <EditCampaignForm campaign={c} tiers={tiers} items={items} />;
}
