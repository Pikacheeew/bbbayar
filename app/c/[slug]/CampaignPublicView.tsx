"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatIDR } from "@/lib/money";
import type { CampaignItem, CampaignPublic, DiscountTier, Participant } from "@/lib/types";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import ProgressBar from "@/components/ProgressBar";
import Stat from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const POLL_MS = 4000;

export default function CampaignPublicView({
  initial,
}: {
  initial: CampaignPublic;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [myParticipation, setMyParticipation] = useState<Participant | null>(null);

  const nextParam = encodeURIComponent(`/c/${initial.slug}`);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      setLoggedIn(!!data.user);
      if (data.user) {
        const { data: participation } = await supabase.rpc("get_my_participation", {
          p_slug: initial.slug,
        });
        setMyParticipation(participation as Participant | null);
      }
      setCheckingAuth(false);
    });
    if (initial.campaign_type === "sell") {
      supabase.rpc("get_discount_tiers", { p_campaign_id: initial.id }).then(({ data }) => {
        if (data) setTiers(data as DiscountTier[]);
      });
      supabase.rpc("get_campaign_items", { p_campaign_id: initial.id }).then(({ data }) => {
        if (data) setItems(data as CampaignItem[]);
      });
    }
  }, [initial.id, initial.slug, initial.campaign_type]);

  useEffect(() => {
    const supabase = createClient();
    const id = setInterval(async () => {
      const { data } = await supabase.rpc("get_campaign_public", {
        p_slug: initial.slug,
      });
      if (data) setCampaign(data as CampaignPublic);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [initial.slug]);

  const hasItems = items.length > 0;
  const cart = items
    .map((it) => ({ item: it, qty: quantities[it.id] ?? 0 }))
    .filter((line) => line.qty > 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.item.price * line.qty, 0);

  function setQty(itemId: string, qty: number) {
    setQuantities((q) => ({ ...q, [itemId]: Math.max(0, qty) }));
  }

  async function handleJoin() {
    setJoining(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_campaign", {
      p_slug: campaign.slug,
      p_items: hasItems
        ? cart.map((line) => ({ campaign_item_id: line.item.id, qty: line.qty }))
        : null,
      p_notes: hasItems ? orderNotes || null : null,
    });
    setJoining(false);
    if (error) {
      setError(
        error.message === "already_joined"
          ? "You've already joined this group buy."
          : error.message === "campaign_closed"
          ? "Joining is closed."
          : error.message === "sold_out"
          ? "Sold out — all units have been claimed."
          : error.message === "items_required"
          ? "Pick at least one item first."
          : error.message
      );
      return;
    }
    const participantId = (data as { id: string }).id;
    router.push(`/c/${campaign.slug}/p/${participantId}`);
  }

  const isOpen = campaign.status === "open";
  const isSell = campaign.campaign_type === "sell";
  const hasStockCap = isSell && campaign.max_qty != null;
  const hasDiscount = isSell && tiers.length > 0;
  const cartDiscountPercent = hasDiscount
    ? tiers.filter((t) => t.min_buyers <= campaign.slots_taken + 1).sort((a, b) => b.discount_percent - a.discount_percent)[0]?.discount_percent ?? 0
    : 0;
  const cartTotalAfterDiscount = Math.round((cartTotal * (100 - cartDiscountPercent)) / 100);

  const currentDiscount = hasDiscount
    ? tiers.filter((t) => t.min_buyers <= campaign.slots_taken).sort((a, b) => b.discount_percent - a.discount_percent)[0]
    : undefined;
  const currentUnitPrice =
    isSell && campaign.base_price
      ? Math.round((campaign.base_price * (100 - (currentDiscount?.discount_percent ?? 0))) / 100)
      : campaign.base_price;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between text-sm">
        <Link href="/home" className="text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <Link href="/me" className="text-muted-foreground hover:text-foreground">
          My payments
        </Link>
      </div>
      <div className="mt-2">
        <CampaignStatusBadge status={campaign.status} myStatus={myParticipation?.status} />
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-foreground text-balance">
        {campaign.title}
      </h1>
      {campaign.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={campaign.image_url}
          alt={campaign.title}
          className="mt-3 h-48 w-full rounded-lg object-cover"
        />
      )}
      {campaign.product_url && (
        <a
          href={campaign.product_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm text-blue-600 underline"
        >
          View product
        </a>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {campaign.campaign_type === "pledge" ? (
          <>
            <Stat breakWords label="Total price" value={formatIDR(campaign.total_amount ?? 0)} />
            <Stat breakWords label="Deadline" value={new Date(campaign.deadline).toLocaleString("id-ID")} />
            <Stat breakWords label="Joined" value={`${campaign.slots_taken}`} />
            <Stat breakWords label="Collected" value={formatIDR(campaign.total_collected)} />
          </>
        ) : hasItems ? (
          <>
            <Stat breakWords label="Menu" value={`${items.length} item${items.length === 1 ? "" : "s"}`} />
            {hasStockCap ? (
              <Stat
                breakWords
                label="Orders left"
                value={`${Math.max((campaign.max_qty ?? 0) - campaign.slots_taken, 0)} / ${campaign.max_qty ?? 0}`}
              />
            ) : (
              <Stat breakWords label="Deadline" value={new Date(campaign.deadline).toLocaleString("id-ID")} />
            )}
            <Stat breakWords label="Orders so far" value={`${campaign.slots_taken}`} />
          </>
        ) : (
          <>
            <Stat breakWords label={hasDiscount ? "Price now" : "Price"} value={formatIDR(currentUnitPrice ?? 0)} />
            {hasDiscount && <Stat breakWords label="List price" value={formatIDR(campaign.base_price ?? 0)} />}
            {hasStockCap ? (
              <Stat
                breakWords
                label="Stock left"
                value={`${Math.max((campaign.max_qty ?? 0) - campaign.slots_taken, 0)} / ${campaign.max_qty ?? 0}`}
              />
            ) : (
              <Stat breakWords label="Deadline" value={new Date(campaign.deadline).toLocaleString("id-ID")} />
            )}
            <Stat breakWords label="Buyers so far" value={`${campaign.slots_taken}`} />
          </>
        )}
      </div>

      {isSell && !campaign.requires_shipping && (
        <Card className="mt-3 p-3 text-sm">
          <p className="font-medium text-foreground">📍 Pickup only — no shipping fee</p>
          {campaign.origin_address && (
            <p className="mt-1 text-muted-foreground">
              Collect at: {campaign.origin_address}, {campaign.origin_city} {campaign.origin_postal_code}
            </p>
          )}
          {campaign.location_url && (
            <a
              href={campaign.location_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-blue-600 underline"
            >
              View on Google Maps ↗
            </a>
          )}
        </Card>
      )}

      {hasDiscount && (
        <Card className="mt-3 p-3 text-sm">
          <p className="font-medium text-foreground">Group discount</p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {tiers.map((t) => (
              <li key={t.id} className={t.min_buyers <= campaign.slots_taken ? "font-medium text-emerald-600" : ""}>
                {t.min_buyers}+ buyers → {t.discount_percent}% off
                {t.min_buyers <= campaign.slots_taken ? " ✓ unlocked" : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!isOpen && !hasStockCap && (
        <div className="mt-3">
          <ProgressBar
            percent={
              campaign.slots_taken > 0
                ? (campaign.paid_count / campaign.slots_taken) * 100
                : 0
            }
            label={`${campaign.paid_count} / ${campaign.slots_taken} paid`}
          />
        </div>
      )}

      {checkingAuth ? null : myParticipation ? (
        <Card className="mt-6 p-4">
          <p className="text-sm text-muted-foreground">
            You&apos;ve already joined this group buy.
          </p>
          <Button
            render={<Link href={`/c/${campaign.slug}/p/${myParticipation.id}`} />}
            nativeButton={false}
            className="mt-3 w-full sm:w-auto"
          >
            Go to your payment page →
          </Button>
        </Card>
      ) : !loggedIn ? (
        <Card className="mt-6 p-4">
          <p className="text-sm text-muted-foreground">
            Log in to join — your name, phone, and email come from your
            account, so there&apos;s nothing else to fill in.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              render={<Link href={`/login?next=${nextParam}`} />}
              nativeButton={false}
              className="w-full sm:w-auto"
            >
              Log in
            </Button>
            <Button
              render={<Link href={`/signup?next=${nextParam}`} />}
              nativeButton={false}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Sign up
            </Button>
          </div>
        </Card>
      ) : isOpen && hasItems ? (
        <Card className="mt-6 p-4 text-left">
          <p className="text-sm font-medium text-foreground">Build your order</p>
          <ul className="mt-3 space-y-3">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                  <p className="text-xs text-muted-foreground">{formatIDR(it.price)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQty(it.id, (quantities[it.id] ?? 0) - 1)}
                  >
                    −
                  </Button>
                  <span className="w-6 text-center text-sm">{quantities[it.id] ?? 0}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQty(it.id, (quantities[it.id] ?? 0) + 1)}
                  >
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="orderNotes">Notes (optional)</Label>
            <Input
              id="orderNotes"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="e.g. no onion, deliver after 5pm"
            />
          </div>

          {cartDiscountPercent > 0 && cartTotal > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-emerald-600">
              <span>Group discount</span>
              <span className="font-medium">{cartDiscountPercent}% off</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between text-sm font-semibold text-foreground">
            <span>Total</span>
            <span>
              {cartDiscountPercent > 0 && cartTotal > 0 && (
                <span className="mr-1 text-muted-foreground line-through">{formatIDR(cartTotal)}</span>
              )}
              {formatIDR(cartDiscountPercent > 0 ? cartTotalAfterDiscount : cartTotal)}
            </span>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={joining || cart.length === 0} className="mt-3 w-full">
            {joining ? "Placing order…" : "Place order"}
          </Button>
        </Card>
      ) : isOpen ? (
        <Card className="mt-6 p-4">
          {hasStockCap && (
            <p className="mb-3 text-xs text-amber-700">
              ⚠️ Joining reserves 1 unit immediately — you&apos;ll need to pay
              within the time limit or it goes back on sale.
            </p>
          )}
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? "Joining…" : hasStockCap ? "Reserve this unit" : "Join this group buy"}
          </Button>
        </Card>
      ) : (
        <Card className="mt-6 p-4 text-sm text-muted-foreground">
          {hasStockCap
            ? "Sold out — all units have been claimed."
            : "Joining is closed. The price per person has been locked in and participants are paying their share now."}
        </Card>
      )}
    </div>
  );
}
