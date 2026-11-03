# BBayar payments: dynamic QRIS on a static ShopeePay QRIS

Buyer pays a QR with a fixed amount: order total + a unique 1–999 rupiah code.
Payment is confirmed by polling the ShopeePay merchant portal for that exact amount.

## Live setup
- Supabase project: **BarengPRO** (`dgzxzbhoehbdvajmpzqm`, ap-southeast-1).
- Tables `payment_intents` and `payment_duplicates` are already applied there (both migrations in `supabase/migrations/`).
  Test row `TEST-001` (Rp 1.209) exists in `payment_intents`.
- Edge functions are NOT deployed yet.
- Merchant: ShopeePay "Belajar Bersama", Pekanbaru, NMID ID1026631251752. The static QRIS string is not secret.

## Files
- `supabase/functions/_shared/qris.ts`: static → dynamic converter (tag 01 → 12, tag 54 amount, CRC-16/CCITT-FALSE). Tested on the real QRIS; real payments went through.
- `supabase/functions/_shared/shopeepay.ts`: the only file that talks to ShopeePay (unofficial portal API).
- `supabase/functions/_shared/match.ts`: payment matching rule (success + exact amount + after QR creation).
- `create-payment`: `{ order_ref, amount }` → reserves a unique code, returns the QRIS.
- `check-payment`: `{ id }` → polls ShopeePay, marks paid, lists repeat payments in `payment_duplicates`.
- `docs/qris-payment-demo.html`: standalone demo with a fake merchant and simulated ShopeePay.

## ShopeePay portal API (confirmed 2026-11-03)
- `POST https://shopeepay.shopee.co.id/merchant/v1/partner-web/get-transaction-list`
- Body: `{"data":{"metadata":{"token":"B:…","language":"id","timezone":"Asia/Jakarta"},"pageSize":10,"filter":{"startTime":<unix s>,"endTime":<unix s>,"serviceList":[1,3]},"sorter":{"field":"createTime","order":"descend"},"next_position":""}}`
- Headers: no cookie, no CSRF. The body token is the only auth. Portal also sends `Origin`, `Referer`, `X-Timestamp-Ms`.

## Still open
1. **Response shape unconfirmed.** `shopeepay.ts` guesses `data.list[]` with `transactionId`, `amount` ("1.633" style), `createTime`, `status === 3`. Get a real response from DevTools (censor names/phones) and fix the mapping.
2. **Secrets** (set in Supabase dashboard, never in code or chat): `STATIC_QRIS`, `SHOPEE_TOKEN`, `SHOPEE_LIST_URL`.
3. Deploy `create-payment` and `check-payment`, then pay a test QR and confirm the row turns `paid`.
4. Repeat payments are only detected when `check-payment` runs on a paid order; add a cron sweep before real volume.
5. Unknown whether ShopeePay accepts calls from Supabase's servers. Check on the first deployed run.

## Known limits (by design)
- A converted QR is not single-use and never expires at the network. The same QR can be paid twice.
  The order settles once; extra payments go to `payment_duplicates` for a manual refund.
- The token is a portal session; it expires and must be replaced by hand.
- BarengPRO has 33 pre-existing SECURITY DEFINER functions callable by `anon` (e.g. `mark_participant_paid`). Not from this work; fix separately.

## Tests
```
node supabase/functions/_shared/qris.test.ts
node supabase/functions/_shared/match.test.ts
deno check supabase/functions/*/index.ts
```
