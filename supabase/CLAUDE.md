# BBayar payments: dynamic QRIS on a static ShopeePay QRIS

Buyer pays a QR with a fixed amount: order total + a unique 1–999 rupiah code.
Payment is confirmed by polling the ShopeePay merchant portal for that exact amount.

## Live setup
- Supabase project: **BarengPRO** (`dgzxzbhoehbdvajmpzqm`, ap-southeast-1).
- Tables `payment_intents` and `payment_duplicates` are already applied there (both migrations in `supabase/migrations/`).
  Test row `TEST-001` (Rp 1.209) exists in `payment_intents`.
- `create-payment` and `check-payment` are deployed (2026-11-04); secrets are set. ShopeePay accepts calls from Supabase.
- Merchant: ShopeePay "Belajar Bersama", Pekanbaru, NMID ID1026631251752. The static QRIS string is not secret.

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
1. **Response wrapper partly confirmed.** Transaction fields are confirmed from a real payment (2026-11-04): `transactionId`, `amount` ("1.209"), `createTime` (unix s), `status === 3`. Result code is the `X-Resp-Code` header (0 = ok). An empty window returns `data: { total: 0, totalNetSales, totalCompletedCount }` with no list. Still a guess: a non-empty list sits at `data.list`.
2. **Secrets** (set in Supabase dashboard, never in code or chat): `STATIC_QRIS`, `SHOPEE_TOKEN`, `SHOPEE_LIST_URL`.
3. Deploy `create-payment` and `check-payment`, apply `20261104000000_lock_mark_participant_paid.sql`, then deploy the app. Pay a test QR and confirm the participant turns `paid`.
   Apply the migration in the same release: before it, anyone can still call `mark_participant_paid`; after it, only the edge function can.
4. Repeat payments are only detected when `check-payment` runs on a paid order; add a cron sweep before real volume.
5. Unknown whether ShopeePay accepts calls from Supabase's servers. Check on the first deployed run.

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
