// The only file that talks to ShopeePay. Everything else sees ShopeeTxn.
//
// Request URL and body confirmed from the portal (2026-11-03).
// Transaction fields confirmed from a real Rp 1.209 payment (2026-11-04):
// transactionId "1294…", amount "1.209", createTime unix s, status 3 = success.
// shortcut: the list's wrapper key (data.list) is still a guess — check the top of a real response.

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
      // The API answers with Access-Control-Allow-Origin: partner.shopee.co.id, so that's the portal's origin.
      "Origin": "https://partner.shopee.co.id",
      "Referer": "https://partner.shopee.co.id/",
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
  // Result code comes in the X-Resp-Code header (0 = ok, confirmed 2026-11-04).
  const code = res.headers.get("X-Resp-Code");
  const json = await res.json();
  if (code !== "0") throw new Error(`ShopeePay error ${code}: ${json.msg ?? json.message ?? "unknown"} (token expired?)`);

  // Fail loudly on the guessed wrapper so the first live run names the real keys instead of "no payment".
  if (!json.data || !("list" in json.data)) {
    throw new Error(`ShopeePay response has no data.list; keys: ${Object.keys(json.data ?? json).join(", ")}`);
  }
  return (json.data.list ?? []).map((t: Record<string, unknown>) => ({
    id: String(t.transactionId ?? t.displayTransactionId),
    amount: parseInt(String(t.amount ?? "0").replace(/[.,]/g, ""), 10) || 0, // "150.237" → 150237
    paidAtSec: Number(t.createTime ?? t.create_time ?? 0),
    success: t.status === 3,
    raw: t,
  }));
}
