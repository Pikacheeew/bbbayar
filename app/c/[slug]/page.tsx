import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CampaignPublic } from "@/lib/types";
import CampaignPublicView from "./CampaignPublicView";

export default async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: campaign, error } = await supabase.rpc("get_campaign_public", {
    p_slug: slug,
  });

  if (error || !campaign) {
    notFound();
  }

  return <CampaignPublicView initial={campaign as CampaignPublic} />;
}
