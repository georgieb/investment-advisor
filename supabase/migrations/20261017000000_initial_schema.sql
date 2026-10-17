-- Investment Advisor: initial schema
--
-- Security model
--   * Every table that holds user data has Row Level Security enabled.
--   * Policies only grant access to the `authenticated` role, and only to rows
--     where user_id = auth.uid(). The `anon` role has no privileges at all.
--   * Holdings reference accounts through a composite (account_id, user_id)
--     foreign key, so a holding can never be attached to another user's account.
--   * No view, function or policy exposes data across users. There is no
--     "public" or "shared" data in this schema.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.risk_level as enum (
  'conservative',
  'moderately_conservative',
  'moderate',
  'moderately_aggressive',
  'aggressive'
);

create type public.account_type as enum (
  'taxable',
  'traditional_ira',
  'roth_ira',
  'employer_401k',
  'roth_401k',
  'hsa',
  'education_529',
  'cash',
  'other'
);

create type public.account_source as enum (
  'manual',
  'schwab'
);

create type public.asset_class as enum (
  'us_equity',
  'intl_equity',
  'bond',
  'cash',
  'real_estate',
  'commodity',
  'crypto',
  'other'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(new.raw_user_meta_data ->> 'display_name', 100));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- risk_profiles: questionnaire answers + computed risk assessment
-- ---------------------------------------------------------------------------

create table public.risk_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Financial situation / retirement plans
  age smallint not null check (age between 18 and 120),
  retirement_age smallint not null check (retirement_age between 18 and 120),
  annual_income numeric(14, 2) not null check (annual_income >= 0),
  emergency_fund_months numeric(5, 1) not null check (emergency_fund_months >= 0),
  current_retirement_savings numeric(16, 2) not null check (current_retirement_savings >= 0),
  monthly_contribution numeric(12, 2) not null check (monthly_contribution >= 0),
  retirement_goal numeric(16, 2) not null check (retirement_goal >= 0),

  -- Raw questionnaire answers (validated in the app; versioned for future changes)
  answers jsonb not null default '{}'::jsonb,
  questionnaire_version smallint not null default 1,

  -- Computed results (0-100 scores)
  capacity_score smallint not null check (capacity_score between 0 and 100),
  tolerance_score smallint not null check (tolerance_score between 0 and 100),
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level public.risk_level not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger risk_profiles_set_updated_at
  before update on public.risk_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- accounts: brokerage / retirement accounts the user holds
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  account_type public.account_type not null,
  institution text check (char_length(institution) <= 100),
  source public.account_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index accounts_user_id_idx on public.accounts (user_id);

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- holdings: positions within an account
-- ---------------------------------------------------------------------------

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,15}$'),
  name text check (char_length(name) <= 200),
  asset_class public.asset_class not null,
  quantity numeric(20, 8) not null check (quantity >= 0),
  cost_basis_per_unit numeric(20, 8) check (cost_basis_per_unit >= 0),
  current_price numeric(20, 8) not null check (current_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The holding's account must belong to the same user.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete cascade
);

create index holdings_user_id_idx on public.holdings (user_id);
create index holdings_account_id_idx on public.holdings (account_id);

create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon, CRUD for authenticated (further limited by RLS)
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.risk_profiles, public.accounts, public.holdings from anon, public;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.risk_profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.holdings to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.risk_profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.holdings enable row level security;

-- profiles (insert happens via the signup trigger; deletion via auth.users cascade)
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- risk_profiles
create policy "Users can view their own risk profile"
  on public.risk_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own risk profile"
  on public.risk_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own risk profile"
  on public.risk_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own risk profile"
  on public.risk_profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

-- accounts
create policy "Users can view their own accounts"
  on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own accounts"
  on public.accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own accounts"
  on public.accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own accounts"
  on public.accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- holdings
create policy "Users can view their own holdings"
  on public.holdings for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own holdings"
  on public.holdings for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own holdings"
  on public.holdings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own holdings"
  on public.holdings for delete to authenticated
  using ((select auth.uid()) = user_id);
