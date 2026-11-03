import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/money";
import type { Campaign } from "@/lib/types";
import LogoutButton from "./LogoutButton";
import DokuPayoutCard from "./DokuPayoutCard";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import Stat from "@/components/Stat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ADMIN_EMAIL = "aldyan.natanael@gmail.com";

interface PlatformStats {
  total_users: number;
  total_campaigns: number;
  pledge_count: number;
  sell_count: number;
  open_count: number;
  closed_count: number;
  completed_count: number;
  total_participants: number;
  paid_participants: number;
  total_revenue: number;
}

interface ActivityRow {
  event_type: "campaign_created" | "joined" | "paid";
  description: string;
  occurred_at: string;
}

const EVENT_LABEL: Record<ActivityRow["event_type"], string> = {
  campaign_created: "New campaign",
  joined: "Joined",
  paid: "Paid",
};

const EVENT_STYLE: Record<ActivityRow["event_type"], string> = {
  campaign_created: "bg-blue-100 text-blue-700",
  joined: "bg-zinc-100 text-zinc-600",
  paid: "bg-emerald-100 text-emerald-700",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: campaigns } = await supabase.rpc("list_my_campaigns");

  const isAdmin = user.email === ADMIN_EMAIL;
  let stats: PlatformStats | null = null;
  let activityList: ActivityRow[] = [];
  if (isAdmin) {
    const { data: statsData } = await supabase.rpc("get_platform_stats");
    stats = (statsData as PlatformStats | null) ?? null;
    const { data: activityData } = await supabase.rpc("list_recent_activity", { p_limit: 40 });
    activityList = (activityData as ActivityRow[] | null) ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          Your group buys (as organizer)
        </h1>
        <LogoutButton />
      </div>

      {isAdmin && stats && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">Platform activity</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Users" value={`${stats.total_users}`} />
            <Stat label="Campaigns" value={`${stats.total_campaigns}`} />
            <Stat label="Participants" value={`${stats.total_participants}`} />
            <Stat label="Revenue collected" value={formatIDR(stats.total_revenue)} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Pledge campaigns" value={`${stats.pledge_count}`} />
            <Stat label="Bulk Sell campaigns" value={`${stats.sell_count}`} />
            <Stat label="Open" value={`${stats.open_count}`} />
            <Stat label="Closed / Completed" value={`${stats.closed_count + stats.completed_count}`} />
          </div>
          <div className="mt-3">
            <Stat
              label="Paid participants"
              value={`${stats.paid_participants} / ${stats.total_participants}`}
            />
          </div>

          {activityList.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                Recent activity
              </h3>
              <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {activityList.map((row, i) => (
                  <li key={i}>
                    <Card className="flex-row items-center justify-between gap-3 p-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge className={`shrink-0 border-transparent ${EVENT_STYLE[row.event_type]}`}>
                          {EVENT_LABEL[row.event_type]}
                        </Badge>
                        <span className="truncate text-foreground">{row.description}</span>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(row.occurred_at).toLocaleString("id-ID")}
                      </span>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <DokuPayoutCard />
      </div>

      <Button render={<Link href="/dashboard/new" />} nativeButton={false} className="mt-6">
        + New group buy
      </Button>

      <ul className="mt-6 space-y-3">
        {(campaigns as Campaign[] | null)?.map((c) => (
          <li key={c.id}>
            <Link href={`/dashboard/${c.slug}`}>
              <Card className="p-4 transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground">{c.title}</span>
                  <CampaignStatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground capitalize">
                  {c.campaign_type} · {formatIDR(c.total_amount ?? c.base_price ?? 0)}
                  {c.campaign_type === "pledge" ? " total" : " / unit"} · {c.slots_taken} joined
                </p>
              </Card>
            </Link>
          </li>
        ))}
        {campaigns?.length === 0 && (
          <p className="text-sm text-muted-foreground">No group buys yet.</p>
        )}
      </ul>
    </div>
  );
}
