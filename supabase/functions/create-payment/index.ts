// POST { order_ref, amount } → { id, amount, qris, expires_at }
// The client renders `qris` into a QR image itself (e.g. the `qrcode` npm package) —
// never send it to a third-party QR image URL.
import { toDynamic } from "../_shared/qris.ts";
import { db, json, preflight } from "../_shared/http.ts";

const STATIC_QRIS = Deno.env.get("STATIC_QRIS")!;
const RESERVE_MIN = 60; // an amount stays reserved this long, so a late payment can't settle a newer order

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const { order_ref, amount } = await req.json().catch(() => ({}));
  if (typeof order_ref !== "string" || !order_ref.trim() || order_ref.length > 100) {
    return json({ error: "order_ref is required (max 100 chars)" }, 400);
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000 - 999) {
    return json({ error: "amount must be a whole rupiah value up to 9,999,001" }, 400);
  }

  const now = new Date();
  await db.from("payment_intents").update({ status: "expired" })
    .eq("status", "pending").lt("expires_at", now.toISOString());

  const since = new Date(now.getTime() - RESERVE_MIN * 60_000).toISOString();
  const { data: recent, error: readErr } = await db.from("payment_intents").select("amount")
    .gte("created_at", since).gt("amount", amount).lte("amount", amount + 999);
  if (readErr) return json({ error: readErr.message }, 500);

  const taken = new Set(recent.map((r) => r.amount));
  const free = Array.from({ length: 999 }, (_, i) => i + 1).filter((c) => !taken.has(amount + c));

  for (let attempt = 0; attempt < 5 && free.length; attempt++) {
    const code = free.splice(Math.floor(Math.random() * free.length), 1)[0];
    const total = amount + code;
    const { data, error } = await db.from("payment_intents").insert({
      order_ref: order_ref.trim(), base_amount: amount, unique_code: code, amount: total,
      qris: toDynamic(STATIC_QRIS, total),
    }).select("id, amount, qris, expires_at").single();
    if (!error) return json(data, 201);
    if (error.code !== "23505") return json({ error: error.message }, 500); // 23505 = another request took this amount; retry
  }
  return json({ error: "Too many open payments at this price, try again shortly" }, 503);
});
