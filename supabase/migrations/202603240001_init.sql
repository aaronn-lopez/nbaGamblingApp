create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'card_tier') then
    create type card_tier as enum ('DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'IRON');
  end if;

  if not exists (select 1 from pg_type where typname = 'pack_type') then
    create type pack_type as enum ('STARTER', 'COMMON', 'RARE', 'LEGENDARY');
  end if;

  if not exists (select 1 from pg_type where typname = 'shop_offer_type') then
    create type shop_offer_type as enum ('PACK', 'FEATURED_CARD');
  end if;

  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type listing_status as enum ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');
  end if;

  if not exists (select 1 from pg_type where typname = 'wallet_entry_type') then
    create type wallet_entry_type as enum (
      'ONBOARDING_GRANT',
      'DAILY_CLAIM',
      'PACK_PURCHASE',
      'CARD_PURCHASE',
      'MARKETPLACE_BUY',
      'MARKETPLACE_SALE',
      'MARKETPLACE_FEE',
      'ADMIN_GRANT'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_kind') then
    create type notification_kind as enum ('SALE_COMPLETE', 'SHOP_ROTATION', 'RANKING_REFRESH', 'MARKET_ALERT');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text not null,
  avatar_seed text not null,
  home_court text not null,
  updated_at timestamptz not null default now()
);

create table if not exists wallets (
  user_id uuid primary key references users(id) on delete cascade,
  currency_code text not null default 'COURT_CASH',
  balance numeric(14,2) not null default 0,
  last_claimed_at timestamptz
);

create table if not exists wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  amount numeric(14,2) not null,
  entry_type wallet_entry_type not null,
  description text not null,
  related_entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists wallet_ledger_user_created_idx on wallet_ledger (user_id, created_at desc);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  external_slug text not null unique,
  full_name text not null,
  team_code text not null,
  position text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists player_stat_snapshots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  source_date date not null,
  season_code text not null,
  recent_pra numeric(8,2) not null,
  season_pra numeric(8,2) not null,
  minutes_trend numeric(8,4) not null,
  availability_score numeric(8,4) not null,
  team_pace numeric(8,2) not null,
  upcoming_games integer not null,
  created_at timestamptz not null default now(),
  unique (player_id, source_date)
);

create table if not exists ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  week_start date not null,
  week_end date not null,
  model_version text not null,
  published_at timestamptz not null,
  active boolean not null default false
);

create unique index if not exists ranking_snapshots_one_active_idx
  on ranking_snapshots ((active))
  where active = true;

create table if not exists ranking_snapshot_players (
  ranking_snapshot_id uuid not null references ranking_snapshots(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  player_power_score numeric(10,2) not null,
  percentile numeric(5,2) not null,
  tier card_tier not null,
  trend_label text not null,
  primary key (ranking_snapshot_id, player_id)
);

create table if not exists card_templates (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  season_code text not null,
  edition text not null,
  card_style text not null,
  accent_color text not null,
  unique (player_id, season_code, edition)
);

create table if not exists card_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references card_templates(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  season_code text not null,
  edition text not null,
  serial_number integer not null,
  tier_at_mint card_tier not null,
  minted_ranking_snapshot_id uuid not null references ranking_snapshots(id),
  minted_at timestamptz not null default now(),
  unique (player_id, season_code, edition, serial_number)
);

create index if not exists card_instances_owner_idx on card_instances (owner_user_id);

create table if not exists pack_definitions (
  id uuid primary key default gen_random_uuid(),
  pack_type pack_type not null unique,
  title text not null,
  description text not null,
  price numeric(14,2) not null,
  cards_per_pack integer not null,
  odds_by_tier jsonb not null,
  active boolean not null default true
);

create table if not exists pack_inventory (
  user_id uuid not null references users(id) on delete cascade,
  pack_type pack_type not null,
  quantity integer not null default 0,
  primary key (user_id, pack_type)
);

create table if not exists pack_open_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  pack_type pack_type not null,
  idempotency_key text,
  ranking_snapshot_id uuid not null references ranking_snapshots(id),
  opened_at timestamptz not null default now()
);

create unique index if not exists pack_open_events_idempotency_idx
  on pack_open_events (user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists pack_open_event_cards (
  pack_open_event_id uuid not null references pack_open_events(id) on delete cascade,
  card_instance_id uuid not null references card_instances(id) on delete cascade,
  primary key (pack_open_event_id, card_instance_id)
);

create table if not exists shop_offers (
  id uuid primary key default gen_random_uuid(),
  offer_type shop_offer_type not null,
  title text not null,
  description text not null,
  price numeric(14,2) not null,
  active boolean not null default true,
  pack_type pack_type,
  player_id uuid references players(id),
  ranking_snapshot_id uuid references ranking_snapshots(id),
  starts_at timestamptz,
  ends_at timestamptz
);

create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references users(id) on delete cascade,
  card_instance_id uuid not null unique references card_instances(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  tier_at_mint card_tier not null,
  serial_number integer not null,
  asking_price numeric(14,2) not null,
  listed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status listing_status not null default 'ACTIVE'
);

create index if not exists marketplace_listings_status_idx
  on marketplace_listings (status, expires_at);

create table if not exists marketplace_purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references marketplace_listings(id) on delete cascade,
  buyer_user_id uuid not null references users(id) on delete cascade,
  seller_user_id uuid not null references users(id) on delete cascade,
  card_instance_id uuid not null references card_instances(id) on delete cascade,
  price numeric(14,2) not null,
  fee_paid numeric(14,2) not null,
  idempotency_key text,
  purchased_at timestamptz not null default now()
);

create unique index if not exists marketplace_purchases_idempotency_idx
  on marketplace_purchases (buyer_user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind notification_kind not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
