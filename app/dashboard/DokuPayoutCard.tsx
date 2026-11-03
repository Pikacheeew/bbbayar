"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SubAccount {
  profile_id: string;
  account_no_idr: string;
}

interface Balance {
  available: string;
  reserved: string;
}

export default function DokuPayoutCard() {
  const [account, setAccount] = useState<SubAccount | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/doku/subaccount")
      .then((r) => r.json())
      .then((data) => {
        setAccount(data.account ?? null);
        setBalance(data.balance ?? null);
      })
      .finally(() => setChecked(true));
  }, []);

  async function connect() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/doku/subaccount", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not connect DOKU payouts.");
      return;
    }
    setAccount(data.account);
  }

  if (!checked) return null;

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-foreground">DOKU payouts</p>
      {!account ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect a DOKU sub-account so buyer payments settle directly to you.
          </p>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <Button className="mt-3" disabled={loading} onClick={connect}>
            {loading ? "Connecting…" : "Connect DOKU payouts"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Profile <span className="font-mono">{account.profile_id}</span>
          </p>
          {balance ? (
            <p className="mt-1 text-sm text-foreground">
              Available: Rp {Number(balance.available).toLocaleString("id-ID")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Balance unavailable right now.</p>
          )}
        </>
      )}
    </Card>
  );
}
