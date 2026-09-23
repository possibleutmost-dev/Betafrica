-- Casino rounds.
--
-- Every round is decided on the server from a random seed generated before the
-- stake is taken. The seed's SHA-256 hash is stored (and shown to the player)
-- up front, and the seed itself is revealed once the round is over, so a
-- result can be checked against the hash afterwards.
create table if not exists game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  game text not null,
  kind text not null check (kind in ('crash', 'instant')),
  stake numeric(14,2) not null check (stake > 0),
  currency text not null,
  status text not null default 'running' check (status in ('running', 'won', 'lost')),
  multiplier numeric(12,2),
  payout numeric(14,2) not null default 0,
  crash_point numeric(12,2),
  auto_cashout numeric(12,2),
  server_seed text not null,
  seed_hash text not null,
  pick jsonb,
  outcome jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists game_rounds_user_idx on game_rounds (user_id, created_at desc);
create index if not exists game_rounds_running_idx on game_rounds (user_id, game) where status = 'running';

grant all privileges on game_rounds to service_role;
alter table game_rounds enable row level security;
