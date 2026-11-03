// The only file that talks to ShopeePay. Everything else sees ShopeeTxn.
//
// Request URL and body confirmed from the portal (2026-11-03).
// shortcut: response field names (list, transactionId, amount, createTime, status) still
// UNCONFIRMED — check against a real response before going live.

export type ShopeeTxn = {
  id: string;
  amount: number;       // whole rupiah
  paidAtSec: number;    // unix seconds
  success: boolean;
  issuer?: string;
  raw: unknown;
};

const LIST_URL = Deno.env.get("SHOPEE_LIST_URL"); // from the cURL, e.g. .../get-transaction-list
const TOKEN = Deno.env.get("SHOPEE_TOKEN");       // "B:..." session token, stored as a Supabase secret

export async function listShopeeTxns(startSec: number, endSec: number): Promise<ShopeeTxn[]> {
  if (!LIST_URL || !TOKEN) throw new Error("ShopeePay not configured: set SHOPEE_LIST_URL and SHOPEE_TOKEN");

  const res = await fetch(LIST_URL, {
    method: "POST",
    // Same headers the portal sends (confirmed 2026-11-03): no cookie or CSRF, the body token is the only auth.
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://shopeepay.shopee.co.id",
      "Referer": "https://shopeepay.shopee.co.id/",
      "X-Timestamp-Ms": String(Date.now()),
    },
    body: JSON.stringify({
      data: {
        metadata: { token: TOKEN, language: "id", timezone: "Asia/Jakarta" },
        pageSize: 50,
        filter: { startTime: startSec, endTime: endSec, serviceList: [1, 3] },
        sorter: { field: "createTime", order: "descend" },
        next_position: "",
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`ShopeePay HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(`ShopeePay error ${json.code}: ${json.msg ?? "unknown"} (token expired?)`);

  return (json.data?.list ?? []).map((t: Record<string, unknown>) => ({
    id: String(t.transactionId ?? t.displayTransactionId),
    amount: parseInt(String(t.amount ?? "0").replace(/[.,]/g, ""), 10) || 0, // "150.237" → 150237
    paidAtSec: Number(t.createTime ?? t.create_time ?? 0),
    success: t.status === 3,
    raw: t,
  }));
}
