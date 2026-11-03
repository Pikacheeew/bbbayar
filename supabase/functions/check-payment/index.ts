// POST { id } → { status: "pending" | "paid" | "expired", amount, paid_at? }
// The checkout page calls this every ~10s while the QR is open, so ShopeePay is only
// polled while someone is actually paying.
import { listShopeeTxns } from "../_shared/shopeepay.ts";
import { matchTxns } from "../_shared/match.ts";
import { db, json, preflight } from "../_shared/http.ts";

const LOOKBACK_MIN = 60; // stop polling Shopee for intents older than this

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string") return json({ error: "id is required" }, 400);

  const { data: intent, error } = await db.from("payment_intents")
    .select("id, amount, status, created_at, expires_at, paid_at, shopee_txn_id").eq("id", id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!intent) return json({ error: "not found" }, 404);

  const reply = (status: string, extra = {}) => json({ status, amount: intent.amount, ...extra });

  const nowSec = Math.floor(Date.now() / 1000);
  const createdSec = Math.floor(new Date(intent.created_at).getTime() / 1000);
  // Expired intents are still checked within the lookback, so a buyer who paid late is credited.
  if (nowSec - createdSec > LOOKBACK_MIN * 60) return reply(intent.status, intent.paid_at ? { paid_at: intent.paid_at } : {});

  let txns;
  try {
    txns = await listShopeeTxns(createdSec - 60, nowSec);
  } catch (e) {
    console.error("shopee poll failed:", (e as Error).message);
    return json({ status: intent.status, amount: intent.amount, error: "payment check unavailable" }, 502);
  }

  const matches = matchTxns(intent.amount, createdSec, txns);

  if (intent.status === "paid") {
    // Same QR paid again: list every extra payment for refund (primary key keeps each listed once).
    // shortcut: only runs when someone calls check-payment on a paid order; add a cron sweep before real volume.
    const extras = matches.filter((t) => t.id !== intent.shopee_txn_id).map((t) => ({
      shopee_txn_id: t.id, intent_id: intent.id, amount: t.amount,
      paid_at: new Date(t.paidAtSec * 1000).toISOString(), shopee_raw: t.raw,
    }));
    if (extras.length) {
      const { error: dupErr } = await db.from("payment_duplicates").upsert(extras, { ignoreDuplicates: true });
      if (dupErr) console.error("duplicate insert failed:", dupErr.message);
    }
    return reply("paid", { paid_at: intent.paid_at, duplicates: extras.length });
  }

  for (const t of matches) {
    const { data: claimed, error: claimErr } = await db.from("payment_intents").update({
      status: "paid", paid_at: new Date(t.paidAtSec * 1000).toISOString(),
      shopee_txn_id: t.id, payer_issuer: t.issuer ?? null, shopee_raw: t.raw,
    }).eq("id", intent.id).neq("status", "paid").select("paid_at").maybeSingle();
    if (claimErr?.code === "23505") continue; // this ShopeePay payment already settled another intent
    if (claimErr) return json({ error: claimErr.message }, 500);
    if (claimed) return reply("paid", { paid_at: claimed.paid_at });
  }

  if (intent.status === "pending" && new Date(intent.expires_at).getTime() < Date.now()) {
    await db.from("payment_intents").update({ status: "expired" }).eq("id", intent.id).eq("status", "pending");
    return reply("expired");
  }
  return reply(intent.status);
});
