import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ParticipantDetail } from "@/lib/types";
import ParticipantView from "./ParticipantView";

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ slug: string; participantId: string }>;
}) {
  const { participantId } = await params;
  const supabase = await createClient();
  const { data: participant, error } = await supabase.rpc("get_participant", {
    p_participant_id: participantId,
  });

  if (error || !participant) {
    notFound();
  }

  return <ParticipantView initial={participant as ParticipantDetail} />;
}
