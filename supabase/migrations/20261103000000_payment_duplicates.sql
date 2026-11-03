-- A ShopeePay payment of an already-paid order's amount: the buyer paid the same QR twice. Refund by hand.
create table public.payment_duplicates (
  shopee_txn_id  text primary key,              -- each extra payment is listed once
  intent_id      uuid not null references public.payment_intents (id),
  amount         integer not null,
  paid_at        timestamptz not null,
  shopee_raw     jsonb,
  refunded_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index payment_duplicates_intent_id_idx on public.payment_duplicates (intent_id);

alter table public.payment_duplicates enable row level security;
