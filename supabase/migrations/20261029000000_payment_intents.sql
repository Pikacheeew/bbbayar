-- One row per QR shown to a buyer. Amount carries a unique code so a ShopeePay
-- mutation (which has no order id) can be matched back to exactly one intent.
create table public.payment_intents (
  id             uuid primary key default gen_random_uuid(),
  order_ref      text not null,                 -- BBayar order / invoice id
  base_amount    integer not null check (base_amount > 0),
  unique_code    integer not null check (unique_code between 1 and 999),
  amount         integer not null check (amount = base_amount + unique_code),
  qris           text not null,
  status         text not null default 'pending' check (status in ('pending', 'paid', 'expired')),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '15 minutes',
  paid_at        timestamptz,
  shopee_txn_id  text unique,                   -- one ShopeePay payment can settle only one intent
  payer_issuer   text,
  shopee_raw     jsonb
);

-- Two open QRs may never share an amount, or a payment would match both.
create unique index payment_intents_open_amount_uidx
  on public.payment_intents (amount) where status = 'pending';

create index payment_intents_order_ref_idx on public.payment_intents (order_ref);

-- Only edge functions (service role) touch this table.
alter table public.payment_intents enable row level security;
