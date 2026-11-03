"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatThousands } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";

export default function AddParticipantForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [markPaid, setMarkPaid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("add_manual_participant", {
      p_campaign_id: campaignId,
      p_name: name,
      p_phone: phone,
      p_amount: Number(amount),
      p_mark_paid: markPaid,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setName("");
    setPhone("");
    setAmount("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add a customer manually
      </Button>
    );
  }

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm font-medium text-foreground">
          Add a customer manually (e.g. paid cash in person)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="manualName">Name</Label>
            <Input id="manualName" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manualPhone">Phone</Label>
            <Input
              id="manualPhone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manualAmount">Amount (IDR)</Label>
          <Input
            id="manualAmount"
            type="text"
            inputMode="numeric"
            required
            value={formatThousands(amount)}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="15.000"
          />
        </div>
        <label className="flex items-center gap-2">
          <Checkbox checked={markPaid} onCheckedChange={(v) => setMarkPaid(v === true)} />
          <span className="text-sm text-foreground">Mark as already paid</span>
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} size="sm">
            {loading ? "Adding…" : "Add customer"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
