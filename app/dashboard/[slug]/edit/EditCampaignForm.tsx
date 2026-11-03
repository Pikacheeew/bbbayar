"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "@/lib/image-resize";
import { formatThousands } from "@/lib/money";
import type { CampaignItem, CampaignPublic, DiscountTier } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DateTimePicker from "@/components/DateTimePicker";

interface TierRow {
  minBuyers: string;
  discountPercent: string;
}

interface ItemRow {
  name: string;
  price: string;
}

function toDateTime(iso: string): Date {
  return new Date(iso);
}

export default function EditCampaignForm({
  campaign,
  tiers: initialTiers,
  items: initialItems,
}: {
  campaign: CampaignPublic;
  tiers: DiscountTier[];
  items: CampaignItem[];
}) {
  const router = useRouter();
  const isPledge = campaign.campaign_type === "pledge";
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(campaign.title);
  const [productUrl, setProductUrl] = useState(campaign.product_url ?? "");
  const [totalAmount, setTotalAmount] = useState(String(campaign.total_amount ?? ""));
  const [basePrice, setBasePrice] = useState(String(campaign.base_price ?? ""));
  const [originAddress, setOriginAddress] = useState(campaign.origin_address ?? "");
  const [originCity, setOriginCity] = useState(campaign.origin_city ?? "");
  const [originPostalCode, setOriginPostalCode] = useState(campaign.origin_postal_code ?? "");
  const [shipsEnabled, setShipsEnabled] = useState(campaign.requires_shipping);
  const [locationUrl, setLocationUrl] = useState(campaign.location_url ?? "");
  const [originCoords, setOriginCoords] = useState<{ latitude: number; longitude: number } | null>(
    campaign.origin_latitude != null && campaign.origin_longitude != null
      ? { latitude: campaign.origin_latitude, longitude: campaign.origin_longitude }
      : null
  );
  const [locatingOrigin, setLocatingOrigin] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoRequestedOriginLocation, setAutoRequestedOriginLocation] = useState(false);
  const [deadline, setDeadline] = useState<Date | null>(
    campaign.max_qty != null ? null : toDateTime(campaign.deadline)
  );

  const itemsEnabled0 = initialItems.length > 0;
  const [itemsEnabled, setItemsEnabled] = useState(itemsEnabled0);
  const [items, setItems] = useState<ItemRow[]>(
    itemsEnabled0
      ? initialItems.map((it) => ({ name: it.name, price: String(it.price) }))
      : [{ name: "", price: "" }]
  );
  const itemsWereLocked = itemsEnabled0;

  const [discountEnabled, setDiscountEnabled] = useState(initialTiers.length > 0);
  const [tiers, setTiers] = useState<TierRow[]>(
    initialTiers.length > 0
      ? initialTiers.map((t) => ({
          minBuyers: String(t.min_buyers),
          discountPercent: String(t.discount_percent),
        }))
      : [
          { minBuyers: "3", discountPercent: "10" },
          { minBuyers: "5", discountPercent: "20" },
          { minBuyers: "10", discountPercent: "25" },
        ]
  );

  const [stockLimitEnabled, setStockLimitEnabled] = useState(campaign.max_qty != null);
  const [maxQty, setMaxQty] = useState(String(campaign.max_qty ?? ""));
  const [reserveMinutes, setReserveMinutes] = useState("15");

  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(campaign.image_url);
  const [resizingImage, setResizingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleUseOriginLocation() {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location.");
      return;
    }
    setLocatingOrigin(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLocatingOrigin(false);
      },
      () => {
        setLocationError("Couldn't get your location — check permissions and try again.");
        setLocatingOrigin(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (autoRequestedOriginLocation || isPledge || !shipsEnabled || originCoords) return;
    setAutoRequestedOriginLocation(true);
    handleUseOriginLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPledge, shipsEnabled, originCoords, autoRequestedOriginLocation]);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResizingImage(true);
    setError(null);
    try {
      const resized = await resizeImage(file);
      setImageBlob(resized);
      setImagePreview(URL.createObjectURL(resized));
    } catch {
      setError("Couldn't process that image — try a different file.");
    } finally {
      setResizingImage(false);
    }
  }

  function updateTier(index: number, field: keyof TierRow, value: string) {
    setTiers((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }
  function addTier() {
    setTiers((rows) => [...rows, { minBuyers: "", discountPercent: "" }]);
  }
  function removeTier(index: number) {
    setTiers((rows) => rows.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }
  function addItem() {
    setItems((rows) => [...rows, { name: "", price: "" }]);
  }
  function removeItem(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  const validItems = items.filter((it) => it.name.trim() && it.price);
  const usesStockCap = !isPledge && stockLimitEnabled;
  const missingFields: string[] = [];
  if (!title.trim()) missingFields.push(isPledge ? "what you're requesting" : "what you're selling");
  if (isPledge && !totalAmount) missingFields.push("total price");
  if (!isPledge && !itemsEnabled && !basePrice) missingFields.push("price per unit");
  if (!isPledge && itemsEnabled && validItems.length === 0) missingFields.push("at least one menu item");
  if (!isPledge && (!originAddress.trim() || !originCity.trim() || !originPostalCode.trim())) {
    missingFields.push("pickup address");
  }
  if (usesStockCap && !maxQty) missingFields.push("stock available");
  if (!usesStockCap && !deadline) missingFields.push("deadline");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingFields.length > 0) {
      setError(`Still need: ${missingFields.join(", ")}.`);
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = createClient();

    const farFutureDeadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();

    let imageUrl: string | null = campaign.image_url;
    if (imageBlob) {
      const path = `${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(path, imageBlob, { contentType: "image/jpeg" });
      if (uploadError) {
        setLoading(false);
        setError(uploadError.message);
        return;
      }
      imageUrl = supabase.storage.from("campaign-images").getPublicUrl(path).data.publicUrl;
    }

    const { data, error } = await supabase.rpc("update_campaign", {
      p_campaign_id: campaign.id,
      p_title: title,
      p_product_url: productUrl || null,
      p_total_amount: isPledge ? Number(totalAmount) : null,
      p_base_price: !isPledge && !itemsEnabled ? Number(basePrice) : null,
      p_max_qty: usesStockCap ? Number(maxQty) : null,
      p_reserve_minutes: usesStockCap ? Number(reserveMinutes) : null,
      p_deadline: usesStockCap ? farFutureDeadline : (deadline ?? new Date()).toISOString(),
      p_discount_tiers:
        !isPledge && discountEnabled
          ? tiers
              .filter((t) => t.minBuyers && t.discountPercent)
              .map((t) => ({
                min_buyers: Number(t.minBuyers),
                discount_percent: Number(t.discountPercent),
              }))
          : null,
      p_image_url: imageUrl,
      p_origin_address: !isPledge ? originAddress : null,
      p_origin_city: !isPledge ? originCity : null,
      p_origin_postal_code: !isPledge ? originPostalCode : null,
      p_items:
        !isPledge && itemsEnabled
          ? validItems.map((it) => ({ name: it.name.trim(), price: Number(it.price) }))
          : null,
      p_requires_shipping: !isPledge ? shipsEnabled : true,
      p_location_url: !isPledge ? locationUrl || null : null,
      p_origin_latitude: !isPledge ? originCoords?.latitude ?? null : null,
      p_origin_longitude: !isPledge ? originCoords?.longitude ?? null : null,
    });
    setLoading(false);
    if (error) {
      setError(
        error.message === "already_paid"
          ? "Someone has already paid — this group buy can no longer be edited."
          : error.message === "items_locked"
          ? "The menu can't be changed anymore because there are already orders against it. Everything else was saved — reload to see it."
          : error.message
      );
      return;
    }
    router.push(`/dashboard/${(data as { slug: string }).slug}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/dashboard/${campaign.slug}`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to group buy
      </Link>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-xl">Edit {isPledge ? "pledge" : "bulk sell"}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-[1fr_260px]">
              <div className="space-y-1.5 md:col-start-1">
                <Label htmlFor="title">{isPledge ? "What are you requesting?" : "What are you selling?"}</Label>
                <Input
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-sm placeholder:text-sm"
                />
              </div>

              <div className="space-y-1.5 md:col-start-2 md:[grid-row:1/span_16]">
                <Label htmlFor="image">Picture</Label>
                <input
                  ref={imageInputRef}
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="aspect-[4/3] w-full rounded-md border object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute right-2 bottom-2"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={resizingImage}
                    onClick={() => imageInputRef.current?.click()}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {resizingImage ? "Resizing…" : "+ Upload picture"}
                  </button>
                )}
              </div>

              <div className="space-y-1.5 md:col-start-1">
                <Label htmlFor="productUrl">Product link (optional)</Label>
                <Input
                  id="productUrl"
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              {isPledge && (
                <div className="space-y-1.5 md:col-start-1">
                  <Label htmlFor="totalAmount">Total price (IDR)</Label>
                  <Input
                    id="totalAmount"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatThousands(totalAmount)}
                    onChange={(e) => setTotalAmount(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              )}

              {!isPledge && (
                <>
                  {!itemsEnabled && (
                    <div className="space-y-1.5 md:col-start-1">
                      <Label htmlFor="basePrice">Price per unit (IDR)</Label>
                      <Input
                        id="basePrice"
                        type="text"
                        inputMode="numeric"
                        required
                        value={formatThousands(basePrice)}
                        onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 md:col-start-1">
                    <Checkbox
                      checked={itemsEnabled}
                      onCheckedChange={(v) => setItemsEnabled(v === true)}
                      disabled={itemsWereLocked}
                    />
                    <span className="text-sm font-medium text-foreground">
                      Menu with item variations (e.g. flavor / portion / add-ons)
                    </span>
                  </label>
                  {itemsWereLocked && (
                    <p className="text-xs text-muted-foreground md:col-start-1">
                      Orders already reference this menu, so items can&apos;t be restructured —
                      you can still edit everything else.
                    </p>
                  )}
                  {itemsEnabled && (
                    <div className="space-y-2 rounded-md border p-3 md:col-start-1">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            placeholder="e.g. Chicken Spicy, Half Rice, Extra Chicken"
                            value={item.name}
                            onChange={(e) => updateItem(i, "name", e.target.value)}
                            disabled={itemsWereLocked}
                            className="flex-1"
                          />
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Price"
                            value={formatThousands(item.price)}
                            onChange={(e) => updateItem(i, "price", e.target.value.replace(/\D/g, ""))}
                            disabled={itemsWereLocked}
                            className="w-28"
                          />
                          {!itemsWereLocked && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => removeItem(i)}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      ))}
                      {!itemsWereLocked && (
                        <Button type="button" variant="outline" size="sm" onClick={addItem}>
                          + Add item
                        </Button>
                      )}
                    </div>
                  )}

                  <label className="flex items-center gap-2 md:col-start-1">
                    <Checkbox
                      checked={shipsEnabled}
                      onCheckedChange={(v) => setShipsEnabled(v === true)}
                    />
                    <span className="text-sm font-medium text-foreground">Ships to buyers</span>
                  </label>
                  <p className="text-xs text-muted-foreground md:col-start-1">
                    {shipsEnabled
                      ? "On: each order is shipped individually (1-to-1) to the buyer's own address — they pay a shipping fee."
                      : "Off: this is a drop-off point — buyers collect their order themselves, no shipping fee."}
                  </p>

                  <div className="space-y-1.5 md:col-start-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="originAddress">
                        {shipsEnabled ? "Ships from (pickup address)" : "Drop-off point address"}
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleUseOriginLocation}
                        disabled={locatingOrigin}
                      >
                        {locatingOrigin
                          ? "Locating…"
                          : originCoords
                          ? "📍 Pinned ✓"
                          : "📍 Use my current location"}
                      </Button>
                    </div>
                    {locationError && <p className="text-xs text-destructive">{locationError}</p>}
                    <Input
                      id="originAddress"
                      required
                      value={originAddress}
                      onChange={(e) => setOriginAddress(e.target.value)}
                      placeholder="Street, house number, RT/RW"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        aria-label="Origin city"
                        required
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        placeholder="City"
                      />
                      <Input
                        aria-label="Origin postal code"
                        required
                        value={originPostalCode}
                        onChange={(e) => setOriginPostalCode(e.target.value)}
                        placeholder="Postal code"
                      />
                    </div>
                    {shipsEnabled && !originCoords && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        📍 Without your pinned location, buyers won&apos;t get live Instant
                        (GoSend/Grab) pricing — JNT still works fine from the address alone.
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleUseOriginLocation}
                          disabled={locatingOrigin}
                          className="mt-2 w-full"
                        >
                          {locatingOrigin ? "Locating…" : "Enable location"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 md:col-start-1">
                    <Label htmlFor="locationUrl">Google Maps link (optional)</Label>
                    <Input
                      id="locationUrl"
                      type="url"
                      value={locationUrl}
                      onChange={(e) => setLocationUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/…"
                    />
                  </div>

                  <label className="flex items-center gap-2 md:col-start-1">
                    <Checkbox
                      checked={discountEnabled}
                      onCheckedChange={(v) => setDiscountEnabled(v === true)}
                    />
                    <span className="text-sm font-medium text-foreground">
                      Quantity discount (more buyers → lower price on {itemsEnabled ? "every order" : "everyone's unit"})
                    </span>
                  </label>
                  {discountEnabled && (
                    <div className="space-y-2 rounded-md border p-3 md:col-start-1">
                      {tiers.map((tier, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">≥</span>
                          <Input
                            type="number"
                            min={1}
                            placeholder="buyers"
                            value={tier.minBuyers}
                            onChange={(e) => updateTier(i, "minBuyers", e.target.value)}
                            className="w-20"
                          />
                          <span className="text-xs text-muted-foreground">buyers →</span>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            placeholder="%"
                            value={tier.discountPercent}
                            onChange={(e) => updateTier(i, "discountPercent", e.target.value)}
                            className="w-16"
                          />
                          <span className="text-xs text-muted-foreground">% off</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-muted-foreground"
                            onClick={() => removeTier(i)}
                          >
                            ✕
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addTier}>
                        + Add tier
                      </Button>
                    </div>
                  )}

                  <label className="flex items-center gap-2 md:col-start-1">
                    <Checkbox
                      checked={stockLimitEnabled}
                      onCheckedChange={(v) => setStockLimitEnabled(v === true)}
                    />
                    <span className="text-sm font-medium text-foreground">
                      Limit stock (first come, first served — pay fast or lose it)
                    </span>
                  </label>
                  {stockLimitEnabled && (
                    <div className="grid grid-cols-2 gap-4 rounded-md border p-3 md:col-start-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="maxQty">{itemsEnabled ? "Max orders" : "Stock available"}</Label>
                        <Input
                          id="maxQty"
                          type="number"
                          required
                          min={1}
                          value={maxQty}
                          onChange={(e) => setMaxQty(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="reserveMinutes">Pay within (minutes)</Label>
                        <Input
                          id="reserveMinutes"
                          type="number"
                          required
                          min={1}
                          value={reserveMinutes}
                          onChange={(e) => setReserveMinutes(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {!usesStockCap && (
                <div className="space-y-1.5 md:col-start-1">
                  <Label>Deadline to join</Label>
                  <DateTimePicker value={deadline} onChange={setDeadline} />
                </div>
              )}
            </div>

            {missingFields.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Still need: {missingFields.join(", ")}.
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || resizingImage || missingFields.length > 0}
              className="mt-2 w-full"
            >
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
