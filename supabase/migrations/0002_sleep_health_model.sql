-- Precise sleep aggregates on daily records plus normalized Apple Health samples.
alter table public.daily_records
  add column if not exists sleep_source text
    check (sleep_source is null or sleep_source in ('manual', 'apple_health')),
  add column if not exists sleep_start_at timestamptz,
  add column if not exists sleep_end_at timestamptz;

do $$
begin
  alter table public.daily_records
    add constraint daily_records_sleep_interval_valid
    check (sleep_start_at is null or sleep_end_at is null or sleep_end_at > sleep_start_at);
exception
  when duplicate_object then null;
end;
$$;

update public.daily_records
set sleep_source = 'manual'
where sleep_source is null
  and sleep_start_time is not null
  and wake_time is not null;

create table if not exists public.health_sleep_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  source_identifier text not null,
  source_bundle_id text,
  device_name text,
  sleep_stage text not null check (sleep_stage in ('in_bed', 'awake', 'asleep', 'core', 'deep', 'rem', 'unspecified')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint health_sleep_sample_interval_valid check (end_at > start_at),
  constraint health_sleep_sample_source_unique unique (user_id, source_identifier)
);

create index if not exists idx_health_sleep_samples_user_date
  on public.health_sleep_samples(user_id, record_date, start_at);

alter table public.health_sleep_samples enable row level security;

drop policy if exists "health_sleep_samples_select_own" on public.health_sleep_samples;
drop policy if exists "health_sleep_samples_insert_own" on public.health_sleep_samples;
drop policy if exists "health_sleep_samples_update_own" on public.health_sleep_samples;
drop policy if exists "health_sleep_samples_delete_own" on public.health_sleep_samples;

create policy "health_sleep_samples_select_own" on public.health_sleep_samples
  for select using ((select auth.uid()) = user_id);
create policy "health_sleep_samples_insert_own" on public.health_sleep_samples
  for insert with check ((select auth.uid()) = user_id);
create policy "health_sleep_samples_update_own" on public.health_sleep_samples
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "health_sleep_samples_delete_own" on public.health_sleep_samples
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.health_sleep_samples to authenticated;
