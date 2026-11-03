import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBiteshipRates } from "@/lib/biteship";
import type { ParticipantDetail, ShippingMethod } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { participantId, method, address, city, postalCode, latitude, longitude } =
    (await req.json()) as {
      participantId: string;
      method: ShippingMethod;
      address: string;
      city: string;
      postalCode: string;
      latitude?: number | null;
      longitude?: number | null;
    };

  const supabase = await createClient();

  const { data: participantData, error: participantError } = await supabase.rpc(
    "get_participant",
    { p_participant_id: participantId }
  );
  if (participantError || !participantData) {
    return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
  }
  const participant = participantData as ParticipantDetail;

  let shippingFeeOverride: number | null = null;
  if (participant.campaign_origin_postal_code) {
    const rates = await getBiteshipRates({
      originPostalCode: participant.campaign_origin_postal_code,
      destinationPostalCode: postalCode,
      itemValue: participant.amount_due ?? 50000,
      originCoords:
        participant.campaign_origin_latitude != null && participant.campaign_origin_longitude != null
          ? { latitude: participant.campaign_origin_latitude, longitude: participant.campaign_origin_longitude }
          : null,
      destinationCoords:
        latitude != null && longitude != null ? { latitude, longitude } : null,
    });
    shippingFeeOverride = method === "instant" ? rates.instant : rates.jnt;
  }

  const { data, error } = await supabase.rpc("choose_shipping", {
    p_participant_id: participantId,
    p_method: method,
    p_address: address,
    p_city: city,
    p_postal_code: postalCode,
    p_shipping_fee_override: shippingFeeOverride,
    p_latitude: latitude ?? null,
    p_longitude: longitude ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ participant: data, usedLiveRate: shippingFeeOverride != null });
}
