# BBayar payments: dynamic QRIS on a static ShopeePay QRIS

Buyer pays a QR with a fixed amount: order total + a unique 1–999 rupiah code.
Payment is confirmed by polling the ShopeePay merchant portal for that exact amount.

## Live setup
- Supabase project: **BarengPRO** (`dgzxzbhoehbdvajmpzqm`, ap-southeast-1).
- Tables `payment_intents` and `payment_duplicates` are already applied there (both migrations in `supabase/migrations/`).
  Test row `TEST-001` (Rp 1.209) exists in `payment_intents`.
- `create-payment` and `check-payment` are deployed (2026-11-04); secrets are set. ShopeePay accepts calls from Supabase.
- Merchant account details live only in the `STATIC_QRIS` secret. Keep them, and the token, out of the repo.

## Changing merchant or token
All three settings are Supabase secrets (the edge functions' `.env`); the code has no merchant data.
Names are listed in `supabase/.env.example`.
- Dashboard: BarengPRO → Edge Functions → Secrets → replace the value → Save. No redeploy needed.
- Or from a file: copy `supabase/.env.example` to `supabase/.env` (git-ignored), fill it in, then
  `npx supabase secrets set --env-file supabase/.env --project-ref dgzxzbhoehbdvajmpzqm`.
- New merchant: also pay a small test QR first; open payments made on the old QRIS won't match the new account.

## Files
- `supabase/functions/_shared/qris.ts`: static → dynamic converter (tag 01 → 12, tag 54 amount, CRC-16/CCITT-FALSE). Tested on the real QRIS; real payments went through.
- `supabase/functions/_shared/shopeepay.ts`: the only file that talks to ShopeePay (unofficial portal API).
- `supabase/functions/_shared/match.ts`: payment matching rule (success + exact amount + after QR creation).
- `create-payment`: `{ participant_id }` → reads the total from `participants`, reserves a unique code, returns the QRIS (reuses an open one). `order_ref` = participant id.
- `check-payment`: `{ id }` → polls ShopeePay, marks the intent and the participant paid (`mark_participant_paid`), lists repeat payments in `payment_duplicates`.
- `ParticipantView.tsx` calls both: shows the QR, polls `check-payment` every 5s. The "Simulate payment" button is gone.
- `docs/qris-payment-demo.html`: standalone demo with a fake merchant and simulated ShopeePay.

## ShopeePay portal API (confirmed 2026-11-03)
- `POST https://shopeepay.shopee.co.id/merchant/v1/partner-web/get-transaction-list`
- Body: `{"data":{"metadata":{"token":"B:…","language":"id","timezone":"Asia/Jakarta"},"pageSize":10,"filter":{"startTime":<unix s>,"endTime":<unix s>,"serviceList":[1,3]},"sorter":{"field":"createTime","order":"descend"},"next_position":""}}`
- Headers: no cookie, no CSRF. The body token is the only auth. Portal also sends `Origin`, `Referer`, `X-Timestamp-Ms`.

## Still open
1. **Response shape confirmed** (2026-11-04, matched a real Rp 1.037 payment end to end): `data.list[]` with `transactionId`, `amount` ("1.037"), `createTime` (unix s), `status === 3`. Result code is the `X-Resp-Code` header (0 = ok). An empty window returns `data: { total: 0, ... }` with no list.
2. **Secrets** are set (never in code or chat): `STATIC_QRIS`, `SHOPEE_TOKEN`, `SHOPEE_LIST_URL`. See "Changing merchant or token".
3. Live since 2026-11-04: app on Vercel project **bbbayar** (bbbayar.in, deployed with `npx vercel deploy --prod` from this folder; no Git auto-deploy), lock migration applied. Still untested: a real participant paying through the page (participant turns `paid`).
4. Repeat payments are only detected when `check-payment` runs on a paid order; add a cron sweep before real volume.
5. ShopeePay accepts calls from Supabase (confirmed 2026-11-04).

## Known limits (by design)
- A converted QR is not single-use and never expires at the network. The same QR can be paid twice.
  The order settles once; extra payments go to `payment_duplicates` for a manual refund.
- The token is a portal session; it expires and must be replaced by hand.
- BarengPRO has ~32 other pre-existing SECURITY DEFINER functions callable by `anon`. Not from this work; review separately.

## Tests
```
npx tsx supabase/functions/_shared/qris.test.ts    # Node 20 can't run .ts directly
npx tsx supabase/functions/_shared/match.test.ts
deno check supabase/functions/*/index.ts
```
