"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForceCloseButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("force_close_campaign", {
      p_campaign_id: campaignId,
    });
    setLoading(false);
    setConfirming(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">
          Force-close now? Slots stop, and everyone&apos;s exact share gets
          locked in.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="destructive" size="sm" onClick={handleConfirm} disabled={loading}>
            {loading ? "Closing…" : "Yes, close now"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}>
        Force close now
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
