import { NextRequest, NextResponse } from "next/server";
import { getBiteshipRates } from "@/lib/biteship";

export async function POST(req: NextRequest) {
  const {
    originPostalCode,
    destinationPostalCode,
    itemValue,
    originCoords,
    destinationCoords,
  } = await req.json();
  if (!originPostalCode || !destinationPostalCode) {
    return NextResponse.json({ instant: null, jnt: null });
  }
  const rates = await getBiteshipRates({
    originPostalCode: String(originPostalCode),
    destinationPostalCode: String(destinationPostalCode),
    itemValue: Number(itemValue) || 50000,
    originCoords: originCoords ?? null,
    destinationCoords: destinationCoords ?? null,
  });
  return NextResponse.json(rates);
}
