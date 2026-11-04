"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/money";
import type { ParticipantDetail, ShippingMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLES } from "@/lib/participant-status";
import { SHIPPING_FEE, SHIPPING_LABEL } from "@/lib/fees";

const POLL_MS = 4000;
const CHECK_PAYMENT_MS = 5000;

type PaymentQr = { id: string; amount: number; qris: string; expires_at: string };

function paymentReferenceCode(participantId: string) {
  const clean = participantId.replace(/-/g, "").toUpperCase().slice(0, 16);
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ParticipantView({
  initial,
}: {
  initial: ParticipantDetail;
}) {
  const [participant, setParticipant] = useState<ParticipantDetail | null>(initial);
  const [expired, setExpired] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentQr | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("jnt");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [submittingShipping, setSubmittingShipping] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoRequestedLocation, setAutoRequestedLocation] = useState(false);
  const [liveRates, setLiveRates] = useState<{ instant: number | null; jnt: number | null }>({
    instant: null,
    jnt: null,
  });

  useEffect(() => {
    const supabase = createClient();
    const id = setInterval(async () => {
      const { data, error } = await supabase.rpc("get_participant", {
        p_participant_id: initial.id,
      });
      if (error) {
        setExpired(true);
        return;
      }
      if (data) setParticipant(data as ParticipantDetail);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [initial.id]);

  useEffect(() => {
    if (participant?.reserved_until) {
      const tick = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(tick);
    }
  }, [participant?.reserved_until]);

  const canPay = participant?.status === "awaiting_payment" && !!participant?.qr_payload;

  useEffect(() => {
    if (!canPay || payment || paymentError) return;
    createClient()
      .functions.invoke("create-payment", { body: { participant_id: initial.id } })
      .then(({ data, error }) => {
        if (error) setPaymentError("Couldn't create your payment QR. Please try again.");
        else setPayment(data as PaymentQr);
      });
  }, [canPay, payment, paymentError, initial.id]);

  useEffect(() => {
    if (!canPay || !payment) return;
    QRCode.toDataURL(payment.qris, { width: 240 }).then(setQrDataUrl);
    const supabase = createClient();
    const id = setInterval(async () => {
      const { data } = await supabase.functions.invoke("check-payment", { body: { id: payment.id } });
      if (data?.status === "expired") setPayment(null);
      if (data?.status === "paid") {
        // Swap the QR for "Paid" now instead of waiting for the next get_participant poll.
        const { data: fresh } = await supabase.rpc("get_participant", { p_participant_id: initial.id });
        if (fresh) setParticipant(fresh as ParticipantDetail);
      }
    }, CHECK_PAYMENT_MS);
    return () => clearInterval(id);
  }, [canPay, payment, initial.id]);

  useEffect(() => {
    const originPostalCode = participant?.campaign_origin_postal_code;
    if (!originPostalCode || postalCode.trim().length < 5) {
      setLiveRates({ instant: null, jnt: null });
      return;
    }
    const originLat = participant?.campaign_origin_latitude;
    const originLng = participant?.campaign_origin_longitude;
    const controller = new AbortController();
    fetch("/api/shipping-rate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originPostalCode,
        destinationPostalCode: postalCode,
        itemValue: participant?.amount_due ?? 50000,
        originCoords: originLat != null && originLng != null ? { latitude: originLat, longitude: originLng } : null,
        destinationCoords: coords,
      }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then(setLiveRates)
      .catch(() => {});
    return () => controller.abort();
  }, [
    postalCode,
    participant?.campaign_origin_postal_code,
    participant?.campaign_origin_latitude,
    participant?.campaign_origin_longitude,
    participant?.amount_due,
    coords,
  ]);

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError("Couldn't get your location — check permissions and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (autoRequestedLocation || !participant) return;
    const needsShipping =
      participant.campaign_type !== "pledge" &&
      participant.status === "awaiting_payment" &&
      !participant.qr_payload;
    if (!needsShipping) return;
    setAutoRequestedLocation(true);
    handleUseLocation();
  }, [participant, autoRequestedLocation]);

  async function handleConfirmShipping() {
    if (!participant) return;
    setSubmittingShipping(true);
    setError(null);
    const res = await fetch("/api/confirm-shipping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        participantId: participant.id,
        method: shippingMethod,
        address,
        city,
        postalCode,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      }),
    });
    const body = await res.json();
    setSubmittingShipping(false);
    if (!res.ok) {
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setParticipant(body.participant as ParticipantDetail);
  }

  if (expired || !participant) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 text-center sm:px-6 sm:py-10">
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted-foreground">
            This reservation is no longer available — the pay-by timer likely
            ran out and the unit went back on sale to someone else.
          </p>
          <Button render={<Link href="/home" />} nativeButton={false} className="mt-4 w-full">
            ← Back to home
          </Button>
        </Card>
      </div>
    );
  }

  const isPledge = participant.campaign_type === "pledge";
  const hasReservationTimer = participant.reserved_until != null;
  const readyForShipping =
    !isPledge && participant.status === "awaiting_payment" && !participant.qr_payload;
  const readyForPayment = participant.status === "awaiting_payment" && !!participant.qr_payload;
  const liveShippingFee = liveRates[shippingMethod];
  const instantNeedsLocation = shippingMethod === "instant" && liveShippingFee == null;
  const shippingFee = instantNeedsLocation ? 0 : liveShippingFee ?? SHIPPING_FEE[shippingMethod];
  const previewTotal = (participant.amount_due ?? 0) + shippingFee + participant.admin_fee;
  const finalTotal = (participant.amount_due ?? 0) + participant.shipping_fee + participant.admin_fee;
  const countdownMs = participant.reserved_until
    ? new Date(participant.reserved_until).getTime() - now
    : null;
  const hasOrderItems = (participant.order_items?.length ?? 0) > 0;
  const itemsSubtotal = participant.order_items?.reduce((s, l) => s + l.unit_price * l.qty, 0) ?? 0;
  const discountPercent = hasOrderItems
    ? itemsSubtotal > 0 && participant.amount_due != null
      ? Math.round((1 - participant.amount_due / itemsSubtotal) * 100)
      : 0
    : !isPledge && participant.campaign_base_price && participant.amount_due != null
    ? Math.round((1 - participant.amount_due / participant.campaign_base_price) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 text-center sm:px-6 sm:py-10">
      <div className="flex items-center justify-between text-sm">
        <Link href="/home" className="text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          My payments
        </Link>
      </div>
      <h1 className="mt-2 text-xl font-semibold text-foreground text-balance">
        {participant.campaign_title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Hi {participant.name} 👋</p>

      <div className="mt-3 flex justify-center">
        <Badge className={`border-transparent ${PARTICIPANT_STATUS_STYLES[participant.status]}`}>
          {PARTICIPANT_STATUS_LABEL[participant.status]}
        </Badge>
      </div>

      {hasReservationTimer && countdownMs !== null && participant.status === "awaiting_payment" && (
        <p className="mt-2 text-sm font-medium text-amber-700">
          ⏱ Pay within {formatCountdown(countdownMs)} or this unit is released
        </p>
      )}

      {participant.status === "joined" && (
        <Card className="mt-6 p-6">
          <p className="text-sm text-muted-foreground">
            Please wait a while for your final payment amount — it&apos;s
            locked in once the request closes on{" "}
            <span className="font-medium text-foreground">
              {new Date(participant.deadline).toLocaleString("id-ID")}
            </span>
            . Keep this page bookmarked — your QR code to pay will appear
            here.
          </p>
        </Card>
      )}

      {readyForShipping && (
        <Card className="mt-6 p-6 text-left">
          <p className="text-sm font-medium text-foreground">Payment details</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Group buy</dt>
              <dd className="text-right font-medium text-foreground">
                {participant.campaign_title}
              </dd>
            </div>
            {participant.campaign_type === "pledge" ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Total order</dt>
                  <dd className="font-medium text-foreground">
                    {formatIDR(participant.campaign_total_amount ?? 0)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Split between</dt>
                  <dd className="font-medium text-foreground">
                    {participant.campaign_slots_taken} people
                  </dd>
                </div>
              </>
            ) : hasOrderItems ? (
              <>
                {participant.order_items!.map((line, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {line.qty}x {line.item_name}
                    </dt>
                    <dd className="font-medium text-foreground">
                      {formatIDR(line.unit_price * line.qty)}
                    </dd>
                  </div>
                ))}
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">Order subtotal</dt>
                    <dd className="text-right">
                      <span className="text-muted-foreground line-through">
                        {formatIDR(itemsSubtotal)}
                      </span>{" "}
                      <span className="font-medium text-emerald-600">{discountPercent}% off</span>
                    </dd>
                  </div>
                )}
                {participant.notes && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="text-right text-foreground">{participant.notes}</dd>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Unit price (after discount)</dt>
                  <dd className="font-medium text-foreground">
                    {formatIDR(participant.amount_due ?? 0)}
                  </dd>
                </div>
                {discountPercent > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted-foreground">List price</dt>
                    <dd className="text-right">
                      <span className="text-muted-foreground line-through">
                        {formatIDR(participant.campaign_base_price ?? 0)}
                      </span>{" "}
                      <span className="font-medium text-emerald-600">
                        {discountPercent}% off
                      </span>
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>

          <Separator className="my-4" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Delivery address</p>
            <Button type="button" variant="outline" size="sm" onClick={handleUseLocation} disabled={locating}>
              {locating ? "Locating…" : coords ? "📍 Location pinned ✓" : "📍 Use my current location"}
            </Button>
          </div>
          {locationError && <p className="mt-1 text-xs text-destructive">{locationError}</p>}
          {coords && (
            <p className="mt-1 text-xs text-emerald-600">
              Pinned — this improves accuracy for Instant (GoSend/Grab) rates.
            </p>
          )}
          <div className="mt-3 space-y-1.5">
            <Label htmlFor="address">Street address</Label>
            <Input
              id="address"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, house number, RT/RW"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                required
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Kode pos"
              />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <Label htmlFor="shippingMethod">Shipping method</Label>
            <Select
              items={{
                instant: `${SHIPPING_LABEL.instant} — ${liveRates.instant != null ? formatIDR(liveRates.instant) : "enable location for price"}`,
                jnt: `${SHIPPING_LABEL.jnt} — ${formatIDR(liveRates.jnt ?? SHIPPING_FEE.jnt)}`,
              }}
              value={shippingMethod}
              onValueChange={(v) => setShippingMethod(v as ShippingMethod)}
            >
              <SelectTrigger id="shippingMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">
                  {SHIPPING_LABEL.instant} —{" "}
                  {liveRates.instant != null ? formatIDR(liveRates.instant) : "enable location for price"}
                </SelectItem>
                <SelectItem value="jnt">
                  {SHIPPING_LABEL.jnt} — {formatIDR(liveRates.jnt ?? SHIPPING_FEE.jnt)}
                </SelectItem>
              </SelectContent>
            </Select>
            {liveShippingFee != null && (
              <p className="text-xs text-emerald-600">Live rate from Biteship</p>
            )}
            {instantNeedsLocation && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                📍 We need your location to price Instant (GoSend/Grab) — it can&apos;t be
                estimated from postal code alone.
                {locationError && <p className="mt-1">{locationError}</p>}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseLocation}
                  disabled={locating}
                  className="mt-2 w-full"
                >
                  {locating ? "Locating…" : "Enable location"}
                </Button>
              </div>
            )}
          </div>

          <Separator className="my-3" />
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Product subtotal</dt>
              <dd>{formatIDR(participant.amount_due ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping ({SHIPPING_LABEL[shippingMethod]})</dt>
              <dd>{instantNeedsLocation ? "—" : formatIDR(shippingFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Admin fee</dt>
              <dd>{formatIDR(participant.admin_fee)}</dd>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between text-base font-semibold text-foreground">
              <dt>Total</dt>
              <dd>{instantNeedsLocation ? "—" : formatIDR(previewTotal)}</dd>
            </div>
          </dl>

          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button
            onClick={handleConfirmShipping}
            disabled={submittingShipping || !address || !city || !postalCode || instantNeedsLocation}
            className="mt-4 w-full"
          >
            {submittingShipping
              ? "Saving…"
              : instantNeedsLocation
              ? "Enable location to continue"
              : "Proceed to Payment →"}
          </Button>
        </Card>
      )}

      {readyForPayment && (
        <Card className="mt-6 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isPledge
                ? "Group pledge"
                : participant.campaign_requires_shipping
                ? SHIPPING_LABEL[participant.shipping_method ?? "jnt"]
                : "Pickup"}
            </p>
            <Badge className="border-transparent bg-blue-100 text-blue-700">QRIS</Badge>
          </div>

          {!isPledge && !participant.campaign_requires_shipping && participant.campaign_origin_address && (
            <p className="mt-2 text-xs text-muted-foreground">
              📍 Collect at: {participant.campaign_origin_address}, {participant.campaign_origin_city}{" "}
              {participant.campaign_origin_postal_code}
              {participant.campaign_location_url && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={participant.campaign_location_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Maps ↗
                  </a>
                </>
              )}
            </p>
          )}

          <dl className="mt-3 space-y-1 text-left text-sm">
            {hasOrderItems ? (
              participant.order_items!.map((line, i) => (
                <div key={i} className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {line.qty}x {line.item_name}
                  </dt>
                  <dd>{formatIDR(line.unit_price * line.qty)}</dd>
                </div>
              ))
            ) : (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {isPledge ? "Your share" : "Product subtotal"}
                </dt>
                <dd>{formatIDR(participant.amount_due ?? 0)}</dd>
              </div>
            )}
            {discountPercent > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Group discount</dt>
                <dd className="font-medium text-emerald-600">{discountPercent}% off</dd>
              </div>
            )}
            {participant.notes && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="text-right">{participant.notes}</dd>
              </div>
            )}
            {!isPledge && participant.campaign_requires_shipping && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{formatIDR(participant.shipping_fee)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Admin fee</dt>
              <dd>{formatIDR(participant.admin_fee)}</dd>
            </div>
          </dl>
          <Separator className="my-3" />
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">
            {formatIDR(payment?.amount ?? finalTotal)}
          </p>
          {payment && payment.amount > finalTotal && (
            <p className="mt-1 text-xs text-muted-foreground">
              Includes a unique code of {formatIDR(payment.amount - finalTotal)} so we can match your
              payment. Pay this exact amount.
            </p>
          )}

          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QRIS payment code"
              className="mx-auto mt-4 h-auto w-full max-w-60"
            />
          )}

          <p className="mt-3 text-xs text-muted-foreground">Payment reference</p>
          <p className="font-mono text-sm tracking-wider text-foreground">
            {paymentReferenceCode(participant.id)}
          </p>

          {paymentError ? (
            <>
              <p className="mt-4 text-sm text-destructive">{paymentError}</p>
              <Button onClick={() => setPaymentError(null)} className="mt-3 w-full">
                Try again
              </Button>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              {payment
                ? "Scan with any e-wallet or mobile banking app. This page updates automatically once you've paid."
                : "Preparing your QR…"}
            </p>
          )}
        </Card>
      )}

      {participant.status === "paid" && (
        <Card className="mt-6 border-emerald-200 bg-emerald-50 p-6">
          <p className="text-lg font-medium text-emerald-700">Paid ✓</p>
          <p className="mt-1 text-sm text-emerald-600">
            You paid {formatIDR(payment?.amount ?? finalTotal)}. Thanks!
          </p>
          {!isPledge && !participant.campaign_requires_shipping && participant.campaign_origin_address && (
            <p className="mt-1 text-sm text-emerald-600">
              📍 Collect at: {participant.campaign_origin_address}, {participant.campaign_origin_city}{" "}
              {participant.campaign_origin_postal_code}
            </p>
          )}
          <Button
            render={<Link href="/home" />}
            nativeButton={false}
            className="mt-4 w-full sm:w-auto"
          >
            ← Back to home
          </Button>
        </Card>
      )}
    </div>
  );
}
