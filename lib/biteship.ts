const INSTANT_COURIERS = ["gojek", "grab"];
const REGULAR_COURIER = "jnt";

interface BiteshipPricingEntry {
  courier_code: string;
  courier_name: string;
  courier_service_name: string;
  price: number;
}

interface BiteshipResponse {
  success: boolean;
  pricing?: BiteshipPricingEntry[];
}

interface LatLng {
  latitude: number;
  longitude: number;
}

// ponytail: postal-code accuracy (Medium) unless a pinned lat/long is given
// for that side, in which case we use it — Biteship requires coordinates to
// quote instant couriers (Gojek/Grab) at all.
export async function getBiteshipRates(params: {
  originPostalCode: string;
  destinationPostalCode: string;
  itemValue: number;
  originCoords?: LatLng | null;
  destinationCoords?: LatLng | null;
}): Promise<{ instant: number | null; jnt: number | null }> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) return { instant: null, jnt: null };

  const body: Record<string, unknown> = {
    couriers: [...INSTANT_COURIERS, REGULAR_COURIER].join(","),
    items: [
      {
        name: "Order",
        value: Math.max(params.itemValue, 1),
        length: 20,
        width: 20,
        height: 10,
        weight: 1000,
        quantity: 1,
      },
    ],
  };

  if (params.originCoords) {
    body.origin_latitude = params.originCoords.latitude;
    body.origin_longitude = params.originCoords.longitude;
  } else {
    body.origin_postal_code = Number(params.originPostalCode);
  }

  if (params.destinationCoords) {
    body.destination_latitude = params.destinationCoords.latitude;
    body.destination_longitude = params.destinationCoords.longitude;
  } else {
    body.destination_postal_code = Number(params.destinationPostalCode);
  }

  try {
    const res = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      headers: { authorization: apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { instant: null, jnt: null };
    const data = (await res.json()) as BiteshipResponse;
    if (!data.success || !data.pricing) return { instant: null, jnt: null };

    const instantPrices = data.pricing
      .filter((p) => INSTANT_COURIERS.includes(p.courier_code))
      .map((p) => p.price);
    const jntPrices = data.pricing
      .filter((p) => p.courier_code === REGULAR_COURIER)
      .map((p) => p.price);

    return {
      instant: instantPrices.length ? Math.min(...instantPrices) : null,
      jnt: jntPrices.length ? Math.min(...jntPrices) : null,
    };
  } catch {
    return { instant: null, jnt: null };
  }
}
