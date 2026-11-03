import type { ShopeeTxn } from "./shopeepay.ts";

const CLOCK_SKEW_SEC = 60; // Shopee's clock vs ours

// Successful payments of exactly this amount made after the QR was created.
export function matchTxns(amount: number, createdAtSec: number, txns: ShopeeTxn[]): ShopeeTxn[] {
  return txns.filter((t) => t.success && t.amount === amount && t.paidAtSec >= createdAtSec - CLOCK_SKEW_SEC);
}
