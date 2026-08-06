-- Apple Health sync foundation: normalized samples, device state and safe daily aggregation.
alter table public.daily_records
  add column if not exists weight_source text
    check (weight_source is null or weight_source in ('manual', 'apple_health')),
  add column if not exists active_energy_source text
    check (active_energy_source is null or active_energy_source in ('manual', 'apple_health')),
  add column if not exists health_updated_at timestamptz;

update public.daily_records
set weight_source = 'manual'
where weight is not null and weight_source is null;

update public.daily_records
set active_energy_source = 'manual'
where active_energy_kcal is not null and active_energy_source is null;

create table if not exists public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_identifier text not null,
  sample_type text not null
    check (sample_type in ('sleep', 'body_mass', 'active_energy')),
  sample_subtype text,
  record_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  value numeric,
  unit text,
  source_bundle_id text,
  source_name text,
  device_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_samples_interval_valid check (end_at >= start_at),
  constraint health_samples_value_valid check (
    (sample_type = 'sleep' and value is null)
    or (sample_type in ('body_mass', 'active_energy') and value is not null and value >= 0)
  ),
  constraint health_samples_sleep_stage_valid check (
    sample_type <> 'sleep'
    or sample_subtype in ('in_bed', 'awake', 'asleep', 'core', 'deep', 'rem', 'unspecified')
  ),
  constraint health_samples_source_unique unique (user_id, source_identifier)
);

create index if not exists idx_health_samples_user_date_type
  on public.health_samples(user_id, record_date desc, sample_type);

create table if not exists public.health_sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  platform text not null default 'ios',
  app_version text,
  permissions jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_sync_devices_user_device_unique unique (user_id, device_id)
);

create index if not exists idx_health_sync_devices_user_last_sync
  on public.health_sync_devices(user_id, last_success_at desc);

alter table public.health_samples enable row level security;
alter table public.health_sync_devices enable row level security;

drop policy if exists "health_samples_select_own" on public.health_samples;
drop policy if exists "health_samples_insert_own" on public.health_samples;
drop policy if exists "health_samples_update_own" on public.health_samples;
drop policy if exists "health_samples_delete_own" on public.health_samples;
create policy "health_samples_select_own" on public.health_samples
  for select using ((select auth.uid()) = user_id);
create policy "health_samples_insert_own" on public.health_samples
  for insert with check ((select auth.uid()) = user_id);
create policy "health_samples_update_own" on public.health_samples
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "health_samples_delete_own" on public.health_samples
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "health_sync_devices_select_own" on public.health_sync_devices;
drop policy if exists "health_sync_devices_insert_own" on public.health_sync_devices;
drop policy if exists "health_sync_devices_update_own" on public.health_sync_devices;
drop policy if exists "health_sync_devices_delete_own" on public.health_sync_devices;
create policy "health_sync_devices_select_own" on public.health_sync_devices
  for select using ((select auth.uid()) = user_id);
create policy "health_sync_devices_insert_own" on public.health_sync_devices
  for insert with check ((select auth.uid()) = user_id);
create policy "health_sync_devices_update_own" on public.health_sync_devices
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "health_sync_devices_delete_own" on public.health_sync_devices
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.health_samples to authenticated;
grant select, insert, update, delete on public.health_sync_devices to authenticated;

drop trigger if exists health_samples_touch_updated_at on public.health_samples;
create trigger health_samples_touch_updated_at
  before update on public.health_samples
  for each row execute procedure public.touch_updated_at();

drop trigger if exists health_sync_devices_touch_updated_at on public.health_sync_devices;
create trigger health_sync_devices_touch_updated_at
  before update on public.health_sync_devices
  for each row execute procedure public.touch_updated_at();

create or replace function public.refresh_health_daily_records(
  p_user_id uuid,
  p_dates date[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_date date;
  v_weight numeric;
  v_active_energy integer;
  v_sleep_start timestamptz;
  v_sleep_end timestamptz;
  v_sleep_minutes integer;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;

  foreach v_date in array coalesce(p_dates, array[]::date[])
  loop
    select hs.value
      into v_weight
    from public.health_samples hs
    where hs.user_id = p_user_id
      and hs.record_date = v_date
      and hs.sample_type = 'body_mass'
    order by hs.end_at desc
    limit 1;

    select round(coalesce(sum(hs.value), 0))::integer
      into v_active_energy
    from public.health_samples hs
    where hs.user_id = p_user_id
      and hs.record_date = v_date
      and hs.sample_type = 'active_energy';

    if not exists (
      select 1 from public.health_samples hs
      where hs.user_id = p_user_id
        and hs.record_date = v_date
        and hs.sample_type = 'active_energy'
    ) then
      v_active_energy := null;
    end if;

    select min(hs.start_at), max(hs.end_at)
      into v_sleep_start, v_sleep_end
    from public.health_samples hs
    where hs.user_id = p_user_id
      and hs.record_date = v_date
      and hs.sample_type = 'sleep'
      and hs.sample_subtype in ('asleep', 'core', 'deep', 'rem', 'unspecified');

    with sleep_multirange as (
      select range_agg(tstzrange(hs.start_at, hs.end_at, '[)')) as periods
      from public.health_samples hs
      where hs.user_id = p_user_id
        and hs.record_date = v_date
        and hs.sample_type = 'sleep'
        and hs.sample_subtype in ('asleep', 'core', 'deep', 'rem', 'unspecified')
    )
    select coalesce(
      round(sum(extract(epoch from (upper(period) - lower(period)))) / 60.0)::integer,
      0
    )
      into v_sleep_minutes
    from sleep_multirange
    cross join lateral unnest(sleep_multirange.periods) as period;

    if v_sleep_start is null then
      v_sleep_minutes := null;
    end if;

    if exists (
      select 1 from public.daily_records dr
      where dr.user_id = p_user_id and dr.record_date = v_date
    ) or v_weight is not null or v_active_energy is not null or v_sleep_start is not null then
      insert into public.daily_records (
        user_id,
        record_date,
        weight,
        weight_source,
        active_energy_kcal,
        active_energy_source,
        sleep_start_time,
        sleep_duration_minutes,
        wake_time,
        sleep_source,
        sleep_start_at,
        sleep_end_at,
        health_updated_at
      )
      values (
        p_user_id,
        v_date,
        v_weight,
        case when v_weight is null then null else 'apple_health' end,
        v_active_energy,
        case when v_active_energy is null then null else 'apple_health' end,
        case when v_sleep_start is null then null else v_sleep_start::time end,
        v_sleep_minutes,
        case when v_sleep_end is null then null else v_sleep_end::time end,
        case when v_sleep_start is null then null else 'apple_health' end,
        v_sleep_start,
        v_sleep_end,
        now()
      )
      on conflict (user_id, record_date) do update set
        weight = case
          when public.daily_records.weight_source = 'manual' then public.daily_records.weight
          else excluded.weight
        end,
        weight_source = case
          when public.daily_records.weight_source = 'manual' then 'manual'
          else excluded.weight_source
        end,
        active_energy_kcal = case
          when public.daily_records.active_energy_source = 'manual' then public.daily_records.active_energy_kcal
          else excluded.active_energy_kcal
        end,
        active_energy_source = case
          when public.daily_records.active_energy_source = 'manual' then 'manual'
          else excluded.active_energy_source
        end,
        sleep_start_time = case
          when public.daily_records.sleep_source = 'manual' then public.daily_records.sleep_start_time
          else excluded.sleep_start_time
        end,
        sleep_duration_minutes = case
          when public.daily_records.sleep_source = 'manual' then public.daily_records.sleep_duration_minutes
          else excluded.sleep_duration_minutes
        end,
        wake_time = case
          when public.daily_records.sleep_source = 'manual' then public.daily_records.wake_time
          else excluded.wake_time
        end,
        sleep_source = case
          when public.daily_records.sleep_source = 'manual' then 'manual'
          else excluded.sleep_source
        end,
        sleep_start_at = case
          when public.daily_records.sleep_source = 'manual' then public.daily_records.sleep_start_at
          else excluded.sleep_start_at
        end,
        sleep_end_at = case
          when public.daily_records.sleep_source = 'manual' then public.daily_records.sleep_end_at
          else excluded.sleep_end_at
        end,
        health_updated_at = now();
    end if;
  end loop;
end;
$$;

create or replace function public.ingest_health_samples(
  p_samples jsonb default '[]'::jsonb,
  p_deleted_source_identifiers text[] default array[]::text[],
  p_device_id text default null,
  p_device_name text default null,
  p_app_version text default null,
  p_permissions jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_dates date[];
  v_upserted integer := 0;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select array_agg(distinct affected.record_date)
    into v_dates
  from (
    select (sample ->> 'record_date')::date as record_date
    from jsonb_array_elements(coalesce(p_samples, '[]'::jsonb)) as sample
    where sample ? 'record_date'
    union
    select hs.record_date
    from public.health_samples hs
    where hs.user_id = v_user_id
      and hs.source_identifier = any(coalesce(p_deleted_source_identifiers, array[]::text[]))
  ) affected;

  delete from public.health_samples hs
  where hs.user_id = v_user_id
    and hs.source_identifier = any(coalesce(p_deleted_source_identifiers, array[]::text[]));
  get diagnostics v_deleted = row_count;

  insert into public.health_samples (
    user_id,
    source_identifier,
    sample_type,
    sample_subtype,
    record_date,
    start_at,
    end_at,
    value,
    unit,
    source_bundle_id,
    source_name,
    device_name,
    metadata
  )
  select
    v_user_id,
    incoming.source_identifier,
    incoming.sample_type,
    incoming.sample_subtype,
    incoming.record_date,
    incoming.start_at,
    incoming.end_at,
    incoming.value,
    incoming.unit,
    incoming.source_bundle_id,
    incoming.source_name,
    incoming.device_name,
    coalesce(incoming.metadata, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_samples, '[]'::jsonb)) as incoming(
    source_identifier text,
    sample_type text,
    sample_subtype text,
    record_date date,
    start_at timestamptz,
    end_at timestamptz,
    value numeric,
    unit text,
    source_bundle_id text,
    source_name text,
    device_name text,
    metadata jsonb
  )
  on conflict (user_id, source_identifier) do update set
    sample_type = excluded.sample_type,
    sample_subtype = excluded.sample_subtype,
    record_date = excluded.record_date,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    value = excluded.value,
    unit = excluded.unit,
    source_bundle_id = excluded.source_bundle_id,
    source_name = excluded.source_name,
    device_name = excluded.device_name,
    metadata = excluded.metadata;
  get diagnostics v_upserted = row_count;

  if p_device_id is not null and length(trim(p_device_id)) > 0 then
    insert into public.health_sync_devices (
      user_id,
      device_id,
      device_name,
      app_version,
      permissions,
      last_synced_at,
      last_success_at,
      last_error
    )
    values (
      v_user_id,
      p_device_id,
      p_device_name,
      p_app_version,
      coalesce(p_permissions, '{}'::jsonb),
      now(),
      now(),
      null
    )
    on conflict (user_id, device_id) do update set
      device_name = excluded.device_name,
      app_version = excluded.app_version,
      permissions = excluded.permissions,
      last_synced_at = now(),
      last_success_at = now(),
      last_error = null;
  end if;

  if coalesce(array_length(v_dates, 1), 0) > 0 then
    perform public.refresh_health_daily_records(v_user_id, v_dates);
  end if;

  return jsonb_build_object(
    'upserted', v_upserted,
    'deleted', v_deleted,
    'affected_dates', coalesce(array_length(v_dates, 1), 0),
    'synced_at', now()
  );
end;
$$;

revoke all on function public.refresh_health_daily_records(uuid, date[]) from public;
grant execute on function public.refresh_health_daily_records(uuid, date[]) to authenticated;
revoke all on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) from public;
grant execute on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) to authenticated;
