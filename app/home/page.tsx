import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ParticipantDetail, ParticipantStatus, PledgeCampaign } from "@/lib/types";
import LogoutButton from "@/app/dashboard/LogoutButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import HomeTabs from "./HomeTabs";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/home");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "there";

  const { data } = await supabase.rpc("list_all_campaigns");
  const campaigns = (data as PledgeCampaign[] | null) ?? [];

  const { data: myParticipations } = await supabase.rpc("list_my_participations");
  const participations = (myParticipations as ParticipantDetail[] | null) ?? [];
  const myStatusByCampaign: Record<string, ParticipantStatus> = Object.fromEntries(
    participations.map((p) => [p.campaign_id, p.status])
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Hello, {displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every group buy across BBB, Bayar Bareng Bareng. Click one to join.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            My group buys
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex flex-col p-4">
          <p className="font-medium text-foreground">Pledge</p>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            Everyone chips in for one thing — set a total price and a deadline, and it splits
            evenly once the deadline closes. Good for gifts, dues, or a shared purchase.
          </p>
          <Button
            render={<Link href="/dashboard/new?type=pledge" />}
            nativeButton={false}
            className="mt-3 w-full"
          >
            Start a Pledge →
          </Button>
        </Card>
        <Card className="flex flex-col p-4">
          <p className="font-medium text-foreground">Bulk Sell / Pre-Order</p>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            You&apos;re the seller — set a price (or a menu of items), and each buyer pays their
            own order. Add quantity discounts, stock limits, or pickup/delivery.
          </p>
          <Button
            render={<Link href="/dashboard/new?type=sell" />}
            nativeButton={false}
            className="mt-3 w-full"
          >
            Start Bulk Sell →
          </Button>
        </Card>
        <Card className="flex flex-col p-4">
          <p className="font-medium text-foreground">Group Pay</p>
          <p className="mt-1 flex-1 text-sm text-muted-foreground">
            For a shared activity or slot, like badminton — set a fixed entry price everyone
            pays (e.g. Rp15.000 each), list the sessions on offer, add a Google Maps location,
            and you can add walk-in customers yourself.
          </p>
          <Button
            render={<Link href="/dashboard/new?type=sell" />}
            nativeButton={false}
            variant="outline"
            className="mt-3 w-full"
          >
            Start Group Pay →
          </Button>
        </Card>
      </div>

      <HomeTabs
        campaigns={campaigns}
        myStatusByCampaign={myStatusByCampaign}
        participations={participations}
      />
    </div>
  );
}
