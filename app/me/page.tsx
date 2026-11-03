import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatIDR } from "@/lib/money";
import type { ParticipantDetail } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLES } from "@/lib/participant-status";

const STATUS_ORDER: Record<ParticipantDetail["status"], number> = {
  awaiting_payment: 0,
  joined: 1,
  paid: 2,
};

export default async function MyPaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/me");
  }

  const { data } = await supabase.rpc("list_my_participations");
  const items = ((data as ParticipantDetail[] | null) ?? [])
    .slice()
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const totalDue = items
    .filter((p) => p.status === "awaiting_payment")
    .reduce((sum, p) => sum + (p.amount_due ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-foreground">My payments</h1>
      <p className="mt-1 text-sm text-muted-foreground break-words">
        Every group buy you&apos;ve joined with {user.email}, in one place.
      </p>

      {totalDue > 0 && (
        <Card className="mt-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            You have <span className="font-semibold">{formatIDR(totalDue)}</span>{" "}
            still to pay across your open group buys.
          </p>
        </Card>
      )}

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          You haven&apos;t joined any group buys yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/c/${p.campaign_slug}/p/${p.id}`}>
                <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {p.campaign_title}
                      {p.is_organizer && (
                        <span className="ml-1 text-xs text-muted-foreground">(organizer)</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.amount_due != null ? formatIDR(p.amount_due) : "Amount pending"}
                    </p>
                  </div>
                  <Badge
                    className={`shrink-0 whitespace-nowrap border-transparent ${PARTICIPANT_STATUS_STYLES[p.status]}`}
                  >
                    {PARTICIPANT_STATUS_LABEL[p.status]}
                  </Badge>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
