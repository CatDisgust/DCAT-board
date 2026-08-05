-- Personal Dashboard MVP · initial schema
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Australia/Sydney',
  boundary_time time not null default '20:00',
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  energy_unit text not null default 'kcal' check (energy_unit in ('kcal', 'kj')),
  ai_analysis_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  morning_completed_at timestamptz,
  evening_completed_at timestamptz,
  weight numeric(6,2) check (weight is null or weight > 0),
  sleep_start_time time,
  sleep_duration_minutes integer check (sleep_duration_minutes is null or sleep_duration_minutes between 0 and 1000),
  wake_time time,
  sleep_quality text check (sleep_quality is null or sleep_quality in ('very_poor','poor','average','good','very_good')),
  morning_clarity text check (morning_clarity is null or morning_clarity in ('heavy_brain_fog','tired','normal','clear','very_clear')),
  task_intensity text check (task_intensity is null or task_intensity in ('low','medium','high')),
  active_energy_kcal integer check (active_energy_kcal is null or active_energy_kcal >= 0),
  meal_count integer check (meal_count is null or meal_count between 1 and 4),
  had_large_meal boolean,
  overeating boolean,
  late_night_eating boolean,
  high_fat_sugar_level text check (high_fat_sugar_level is null or high_fat_sugar_level in ('none','small','significant')),
  protein_level text check (protein_level is null or protein_level in ('insufficient','roughly_enough','sufficient')),
  vegetable_level text check (vegetable_level is null or vegetable_level in ('insufficient','roughly_enough','sufficient')),
  carbohydrate_amount text check (carbohydrate_amount is null or carbohydrate_amount in ('low','moderate','high')),
  overall_intake text check (overall_intake is null or overall_intake in ('low','moderate','high','excessive')),
  hunger_affected_sleep boolean,
  boundary_violated boolean,
  boundary_violation_reason text check (boundary_violation_reason is null or boundary_violation_reason in ('unfinished_pre_20_task','new_idea_to_validate','unable_to_stop','thought_it_would_be_quick','compensate_for_low_daytime_progress','mentally_excited','urgent_event','intentional_exception','other')),
  boundary_other_note text check (boundary_other_note is null or length(boundary_other_note) <= 120),
  thoughts_expanding_at_night boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_records_user_date_unique unique (user_id, record_date),
  constraint boundary_reason_required check (boundary_violated is distinct from true or boundary_violation_reason is not null)
);

create index if not exists idx_daily_records_user_date on public.daily_records(user_id, record_date desc);

alter table public.profiles enable row level security;
alter table public.daily_records enable row level security;

create policy "profiles_select_own" on public.profiles for select using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete using ((select auth.uid()) = user_id);

create policy "records_select_own" on public.daily_records for select using ((select auth.uid()) = user_id);
create policy "records_insert_own" on public.daily_records for insert with check ((select auth.uid()) = user_id);
create policy "records_update_own" on public.daily_records for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records_delete_own" on public.daily_records for delete using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
create trigger records_touch_updated_at before update on public.daily_records for each row execute procedure public.touch_updated_at();

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
