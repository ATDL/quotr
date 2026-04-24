-- ============================================================================
-- Quotr v1 — Supabase schema (Postgres)
-- ============================================================================
-- Run this in the Supabase SQL editor once the project is created.
-- Assumes: Supabase Auth is enabled (magic link), and auth.users exists.
--
-- Analogy for the shape of this schema:
--   Think of credits_ledger as your bank's transaction log — the source of truth
--   that never lies. users.credits_balance is your ATM receipt — fast to read,
--   but always reconcilable against the ledger. If they ever disagree, the
--   ledger wins and you recompute the balance.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- users (application-side profile; joined 1:1 with auth.users)
-- ----------------------------------------------------------------------------
-- Supabase's auth.users is the identity table. We mirror a lightweight profile
-- here so we can stamp per-user denormalized fields (credits_balance) and our
-- own timestamps. A trigger below inserts a row on signup.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  credits_balance integer not null default 0,
  created_at timestamptz not null default now()
);

comment on column public.users.credits_balance is
  'Denormalized running balance. Source of truth is credits_ledger. Recompute if ever in doubt.';

-- Auto-create a users row whenever a new auth user signs up, and grant the
-- first credit (the "test-drive" close-out).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, credits_balance)
  values (new.id, new.email, 1);

  insert into public.credits_ledger (user_id, delta, reason)
  values (new.id, 1, 'signup_grant');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- quotes
-- ----------------------------------------------------------------------------
-- A quote the user produced in the calculator and saved. status transitions:
--   'open' (default) -> 'closed' (when a close_out row is created)
create table if not exists public.quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  customer_name text,
  scope text,
  quoted_hours numeric(10,2) not null,
  quoted_materials_cents integer not null,
  hourly_rate_cents integer not null,
  quoted_total_cents integer not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_quotes_user_created
  on public.quotes(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- close_outs
-- ----------------------------------------------------------------------------
-- The paid workflow. One close_out per quote (enforced by unique constraint
-- on quote_id). Computed columns store the P&L so we don't recompute on every
-- dashboard read.
create table if not exists public.close_outs (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  actual_hours numeric(10,2) not null,
  actual_materials_cents integer not null,
  surprise_note text,
  job_type text,
  computed_profit_cents integer not null,
  computed_profit_pct numeric(6,2) not null,
  computed_variance_pct numeric(6,2) not null,
  credits_spent integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_close_outs_user_created
  on public.close_outs(user_id, created_at desc);
create index if not exists idx_close_outs_user_job_type
  on public.close_outs(user_id, job_type);

-- When a close_out lands, flip the parent quote's status to 'closed'.
create or replace function public.mark_quote_closed()
returns trigger
language plpgsql
as $$
begin
  update public.quotes set status = 'closed' where id = new.quote_id;
  return new;
end;
$$;

drop trigger if exists on_close_out_created on public.close_outs;
create trigger on_close_out_created
  after insert on public.close_outs
  for each row execute function public.mark_quote_closed();

-- ----------------------------------------------------------------------------
-- job_types (user-curated list; populated lazily as users type new ones)
-- ----------------------------------------------------------------------------
create table if not exists public.job_types (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists idx_job_types_user
  on public.job_types(user_id);

-- ----------------------------------------------------------------------------
-- credits_ledger (append-only source of truth for credits)
-- ----------------------------------------------------------------------------
-- Every credit movement — grants, purchases, close-out debits, refunds —
-- is a row here. Never update, never delete. Positive delta = credits in,
-- negative delta = credits out.
create table if not exists public.credits_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in (
    'signup_grant',
    'pack_purchase',
    'close_out_debit',
    'refund',
    'manual_adjustment'
  )),
  related_id uuid,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_credits_ledger_user_created
  on public.credits_ledger(user_id, created_at desc);
create unique index if not exists uq_credits_ledger_stripe_pi
  on public.credits_ledger(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Keep users.credits_balance in sync with the ledger on every insert.
-- (We only ever insert into credits_ledger, so no UPDATE/DELETE triggers needed.)
create or replace function public.apply_ledger_to_balance()
returns trigger
language plpgsql
as $$
begin
  update public.users
     set credits_balance = credits_balance + new.delta
   where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists on_credits_ledger_insert on public.credits_ledger;
create trigger on_credits_ledger_insert
  after insert on public.credits_ledger
  for each row execute function public.apply_ledger_to_balance();

-- ----------------------------------------------------------------------------
-- pack_purchases (Stripe audit trail)
-- ----------------------------------------------------------------------------
-- One row per successful Stripe Checkout. The webhook writes this AND writes
-- the matching +delta row into credits_ledger in the same transaction.
create table if not exists public.pack_purchases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  pack_size integer not null check (pack_size in (10, 40)),
  amount_cents integer not null,
  stripe_checkout_session_id text not null unique,
  stripe_payment_intent_id text not null unique,
  completed_at timestamptz not null default now()
);

create index if not exists idx_pack_purchases_user_completed
  on public.pack_purchases(user_id, completed_at desc);

-- ============================================================================
-- Row-Level Security
-- ============================================================================
-- Principle: every row belongs to exactly one user_id, and only that user can
-- see or touch it. Server-side code using the service_role key bypasses RLS
-- (the Stripe webhook needs this).
-- ============================================================================

alter table public.users            enable row level security;
alter table public.quotes           enable row level security;
alter table public.close_outs       enable row level security;
alter table public.job_types        enable row level security;
alter table public.credits_ledger   enable row level security;
alter table public.pack_purchases   enable row level security;

-- users: can read and update own row
drop policy if exists "users self read" on public.users;
create policy "users self read"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "users self update" on public.users;
create policy "users self update"
  on public.users for update
  using (auth.uid() = id);

-- quotes: full CRUD scoped to own user_id
drop policy if exists "quotes owner all" on public.quotes;
create policy "quotes owner all"
  on public.quotes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- close_outs: full CRUD scoped to own user_id (the server action validates credits)
drop policy if exists "close_outs owner all" on public.close_outs;
create policy "close_outs owner all"
  on public.close_outs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- job_types: full CRUD scoped to own user_id
drop policy if exists "job_types owner all" on public.job_types;
create policy "job_types owner all"
  on public.job_types for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- credits_ledger: read-only from the client. Inserts go through service_role
-- (webhook / server action) so client code can never grant itself credits.
drop policy if exists "credits_ledger owner read" on public.credits_ledger;
create policy "credits_ledger owner read"
  on public.credits_ledger for select
  using (auth.uid() = user_id);

-- pack_purchases: read-only from the client. Inserts come from the webhook.
drop policy if exists "pack_purchases owner read" on public.pack_purchases;
create policy "pack_purchases owner read"
  on public.pack_purchases for select
  using (auth.uid() = user_id);

-- ============================================================================
-- Helper view: my_jobs_feed
-- ============================================================================
-- The "My Jobs" list reads this. Includes profit %, variance %, and job type.
-- RLS on the base tables carries through.
-- ============================================================================
create or replace view public.my_jobs_feed as
select
  co.id            as close_out_id,
  q.id             as quote_id,
  co.user_id,
  q.customer_name,
  q.scope,
  q.quoted_total_cents,
  (co.actual_materials_cents + (co.actual_hours * q.hourly_rate_cents)::integer) as actual_total_cents,
  co.computed_profit_cents,
  co.computed_profit_pct,
  co.computed_variance_pct,
  co.job_type,
  co.surprise_note,
  co.created_at    as closed_at
from public.close_outs co
join public.quotes q on q.id = co.quote_id;

-- ============================================================================
-- Migration: hook-layer columns (run after initial schema is in place)
-- ============================================================================
-- "watching_for" captures the user's hunch at quote time ("what could surprise
-- me on this job?"). At close-out, "was_watching_correct" records whether the
-- hunch was right. The pair powers the Hooked-model calibration loop without
-- any new tables.
--
-- Safe to re-run; both use ADD COLUMN IF NOT EXISTS.
-- ============================================================================
alter table public.quotes
  add column if not exists watching_for text;

alter table public.close_outs
  add column if not exists was_watching_correct boolean;

comment on column public.quotes.watching_for is
  'User-captured hunch at quote time about what might surprise them on this job.';
comment on column public.close_outs.was_watching_correct is
  'True if the user confirmed at close-out that their watching_for hunch was right.';

-- ============================================================================
-- Reconciliation helper (run manually if you ever suspect a drift)
-- ============================================================================
-- select u.id, u.credits_balance, coalesce(sum(l.delta), 0) as ledger_sum
--   from public.users u
--   left join public.credits_ledger l on l.user_id = u.id
--   group by u.id, u.credits_balance
--   having u.credits_balance <> coalesce(sum(l.delta), 0);
-- ============================================================================
