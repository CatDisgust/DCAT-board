-- Reconcile derived daily totals by deleting stale synthetic samples before their replacements.
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

revoke all on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) from public;
grant execute on function public.ingest_health_samples(jsonb, text[], text, text, text, jsonb) to authenticated;
