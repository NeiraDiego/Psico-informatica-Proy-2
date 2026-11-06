create extension if not exists pgcrypto;

create table participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  "group" text not null check ("group" in ('A', 'B', 'C')),
  protocol_version text not null,
  app_version text not null,
  assignment_method text not null,
  status text not null check (status in ('registered', 'tutorial', 'in_progress', 'completed', 'interrupted')),
  idempotency_key uuid not null unique,
  access_token_hash text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table puzzle_attempts (
  id uuid primary key,
  client_attempt_id uuid not null unique,
  session_id uuid not null references sessions(id),
  puzzle_id text not null,
  puzzle_version text not null,
  position integer not null check (position between 1 and 3),
  is_primary_outcome boolean not null,
  started_at_client timestamptz not null,
  ended_at_client timestamptz not null,
  duration_ms integer not null check (duration_ms between 0 and 120500),
  time_limit_ms integer,
  outcome text not null check (outcome in ('solved', 'timeout', 'interrupted')),
  success boolean not null,
  total_moves integer not null check (total_moves >= 0),
  movement_latencies_ms jsonb not null,
  final_board jsonb not null,
  created_at timestamptz not null default now(),
  unique(session_id, position)
);

create table movements (
  id uuid primary key,
  attempt_id uuid not null references puzzle_attempts(id) on delete cascade,
  index integer not null check (index > 0),
  type text not null check (type in ('click', 'drag')),
  started_at_ms integer not null,
  ended_at_ms integer not null,
  duration_ms integer not null,
  latency_ms integer not null,
  changes jsonb not null,
  closure text not null check (closure in ('normal', 'cancelled')),
  unique(attempt_id, index)
);

create index puzzle_attempts_session_id_idx on puzzle_attempts(session_id);
create index movements_attempt_id_idx on movements(attempt_id);

alter table participants enable row level security;
alter table sessions enable row level security;
alter table puzzle_attempts enable row level security;
alter table movements enable row level security;
