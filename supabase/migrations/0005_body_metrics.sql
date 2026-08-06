-- Daymark 2.0 body composition and circumference measurements.
alter table public.daily_records
  add column if not exists body_fat_percentage numeric(4,1)
    check (body_fat_percentage is null or body_fat_percentage between 0 and 100),
  add column if not exists body_fat_source text
    check (body_fat_source is null or body_fat_source in ('manual', 'apple_health'));

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measurement_date date not null,
  chest_cm numeric(5,1) not null check (chest_cm > 0 and chest_cm <= 300),
  waist_cm numeric(5,1) not null check (waist_cm > 0 and waist_cm <= 300),
  hip_cm numeric(5,1) not null check (hip_cm > 0 and hip_cm <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_user_date_unique unique (user_id, measurement_date)
);

create index if not exists idx_body_measurements_user_date
  on public.body_measurements(user_id, measurement_date desc);

alter table public.body_measurements enable row level security;

drop policy if exists "body_measurements_select_own" on public.body_measurements;
drop policy if exists "body_measurements_insert_own" on public.body_measurements;
drop policy if exists "body_measurements_update_own" on public.body_measurements;
drop policy if exists "body_measurements_delete_own" on public.body_measurements;
create policy "body_measurements_select_own" on public.body_measurements
  for select using ((select auth.uid()) = user_id);
create policy "body_measurements_insert_own" on public.body_measurements
  for insert with check ((select auth.uid()) = user_id);
create policy "body_measurements_update_own" on public.body_measurements
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "body_measurements_delete_own" on public.body_measurements
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.body_measurements to authenticated;

drop trigger if exists body_measurements_touch_updated_at on public.body_measurements;
create trigger body_measurements_touch_updated_at
  before update on public.body_measurements
  for each row execute procedure public.touch_updated_at();

-- Expand normalized HealthKit samples without changing the ingest RPC signature.
alter table public.health_samples
  drop constraint if exists health_samples_sample_type_check,
  drop constraint if exists health_samples_value_valid;

alter table public.health_samples
  add constraint health_samples_sample_type_check
    check (sample_type in ('sleep', 'body_mass', 'body_fat', 'active_energy')),
  add constraint health_samples_value_valid check (
    (sample_type = 'sleep' and value is null)
    or (sample_type in ('body_mass', 'active_energy') and value is not null and value >= 0)
    or (sample_type = 'body_fat' and value is not null and value between 0 and 100)
  );

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
  v_body_fat numeric;
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

    select hs.value
      into v_body_fat
    from public.health_samples hs
    where hs.user_id = p_user_id
      and hs.record_date = v_date
      and hs.sample_type = 'body_fat'
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
    ) or v_weight is not null or v_body_fat is not null or v_active_energy is not null or v_sleep_start is not null then
      insert into public.daily_records (
        user_id,
        record_date,
        weight,
        weight_source,
        body_fat_percentage,
        body_fat_source,
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
        v_body_fat,
        case when v_body_fat is null then null else 'apple_health' end,
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
        body_fat_percentage = case
          when public.daily_records.body_fat_source = 'manual' then public.daily_records.body_fat_percentage
          else excluded.body_fat_percentage
        end,
        body_fat_source = case
          when public.daily_records.body_fat_source = 'manual' then 'manual'
          else excluded.body_fat_source
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

revoke all on function public.refresh_health_daily_records(uuid, date[]) from public;
grant execute on function public.refresh_health_daily_records(uuid, date[]) to authenticated;

-- Keep the RPC contract unchanged while also refreshing the previous date when
-- HealthKit updates an existing sample and moves it across a local-day boundary.
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
      and (
        hs.source_identifier = any(coalesce(p_deleted_source_identifiers, array[]::text[]))
        or hs.source_identifier in (
          select sample ->> 'source_identifier'
          from jsonb_array_elements(coalesce(p_samples, '[]'::jsonb)) as sample
          where sample ? 'source_identifier'
        )
      )
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

revoke all on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) from public;
grant execute on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) to authenticated;
