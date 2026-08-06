-- Daymark diet system: private food library, reusable templates and immutable daily snapshots.
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  standard_amount numeric(8,2) not null check (standard_amount > 0),
  standard_unit text not null check (length(trim(standard_unit)) between 1 and 20),
  calories_kcal numeric(9,2) not null check (calories_kcal >= 0),
  protein_g numeric(9,2) check (protein_g is null or protein_g >= 0),
  carbs_g numeric(9,2) check (carbs_g is null or carbs_g >= 0),
  fat_g numeric(9,2) check (fat_g is null or fat_g >= 0),
  fiber_g numeric(9,2) check (fiber_g is null or fiber_g >= 0),
  caffeine_mg numeric(9,2) check (caffeine_mg is null or caffeine_mg >= 0),
  tags text[] not null default array[]::text[],
  common_portions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(common_portions) = 'array'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_items_user_name_unique unique (user_id, name)
);

create table if not exists public.diet_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('combination', 'menu')),
  name text not null check (length(trim(name)) between 1 and 80),
  tags text[] not null default array[]::text[],
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diet_templates_user_kind_name_unique unique (user_id, kind, name)
);

create table if not exists public.diet_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.diet_templates(id) on delete cascade,
  food_id uuid not null references public.food_items(id) on delete restrict,
  portion_multiplier numeric(8,3) not null check (portion_multiplier > 0 and portion_multiplier <= 100),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  constraint diet_template_items_food_unique unique (template_id, food_id)
);

create table if not exists public.nutrition_targets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calories_kcal numeric(9,2) check (calories_kcal is null or calories_kcal > 0),
  protein_g numeric(9,2) check (protein_g is null or protein_g > 0),
  carbs_g numeric(9,2) check (carbs_g is null or carbs_g > 0),
  fat_g numeric(9,2) check (fat_g is null or fat_g > 0),
  fiber_g numeric(9,2) check (fiber_g is null or fiber_g > 0),
  caffeine_mg numeric(9,2) check (caffeine_mg is null or caffeine_mg > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  status text not null check (status in ('planned', 'consumed')),
  source_kind text not null check (source_kind in ('food', 'combination', 'menu', 'meal_estimate')),
  source_id uuid,
  group_id uuid not null default gen_random_uuid(),
  food_id uuid references public.food_items(id) on delete set null,
  name_snapshot text not null check (length(trim(name_snapshot)) between 1 and 120),
  standard_amount_snapshot numeric(8,2) not null check (standard_amount_snapshot > 0),
  standard_unit_snapshot text not null check (length(trim(standard_unit_snapshot)) between 1 and 20),
  portion_options_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(portion_options_snapshot) = 'array'),
  quantity numeric(8,3) not null default 1 check (quantity > 0 and quantity <= 100),
  calories_kcal_snapshot numeric(9,2) not null check (calories_kcal_snapshot >= 0),
  protein_g_snapshot numeric(9,2) check (protein_g_snapshot is null or protein_g_snapshot >= 0),
  carbs_g_snapshot numeric(9,2) check (carbs_g_snapshot is null or carbs_g_snapshot >= 0),
  fat_g_snapshot numeric(9,2) check (fat_g_snapshot is null or fat_g_snapshot >= 0),
  fiber_g_snapshot numeric(9,2) check (fiber_g_snapshot is null or fiber_g_snapshot >= 0),
  caffeine_mg_snapshot numeric(9,2) check (caffeine_mg_snapshot is null or caffeine_mg_snapshot >= 0),
  estimated boolean not null default false,
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diet_entries_estimate_shape check (
    (not estimated and source_kind <> 'meal_estimate')
    or (
      estimated and source_kind = 'meal_estimate' and food_id is null
      and protein_g_snapshot is null and carbs_g_snapshot is null
      and fat_g_snapshot is null and fiber_g_snapshot is null
      and caffeine_mg_snapshot is null
    )
  )
);

create index if not exists idx_food_items_user_active
  on public.food_items(user_id, archived, name);
create index if not exists idx_diet_templates_user_active
  on public.diet_templates(user_id, kind, archived, name);
create index if not exists idx_diet_template_items_template
  on public.diet_template_items(template_id, sort_order);
create index if not exists idx_diet_entries_user_date
  on public.diet_entries(user_id, record_date desc, meal_slot);

alter table public.food_items enable row level security;
alter table public.diet_templates enable row level security;
alter table public.diet_template_items enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.diet_entries enable row level security;

drop policy if exists "food_items_select_own" on public.food_items;
drop policy if exists "food_items_insert_own" on public.food_items;
drop policy if exists "food_items_update_own" on public.food_items;
drop policy if exists "food_items_delete_own" on public.food_items;
create policy "food_items_select_own" on public.food_items for select using ((select auth.uid()) = user_id);
create policy "food_items_insert_own" on public.food_items for insert with check ((select auth.uid()) = user_id);
create policy "food_items_update_own" on public.food_items for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "food_items_delete_own" on public.food_items for delete using ((select auth.uid()) = user_id);

drop policy if exists "diet_templates_select_own" on public.diet_templates;
drop policy if exists "diet_templates_insert_own" on public.diet_templates;
drop policy if exists "diet_templates_update_own" on public.diet_templates;
drop policy if exists "diet_templates_delete_own" on public.diet_templates;
create policy "diet_templates_select_own" on public.diet_templates for select using ((select auth.uid()) = user_id);
create policy "diet_templates_insert_own" on public.diet_templates for insert with check ((select auth.uid()) = user_id);
create policy "diet_templates_update_own" on public.diet_templates for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "diet_templates_delete_own" on public.diet_templates for delete using ((select auth.uid()) = user_id);

drop policy if exists "diet_template_items_select_own" on public.diet_template_items;
drop policy if exists "diet_template_items_insert_own" on public.diet_template_items;
drop policy if exists "diet_template_items_update_own" on public.diet_template_items;
drop policy if exists "diet_template_items_delete_own" on public.diet_template_items;
create policy "diet_template_items_select_own" on public.diet_template_items for select using (
  exists (select 1 from public.diet_templates dt where dt.id = template_id and dt.user_id = (select auth.uid()))
);
create policy "diet_template_items_insert_own" on public.diet_template_items for insert with check (
  exists (select 1 from public.diet_templates dt where dt.id = template_id and dt.user_id = (select auth.uid()))
  and exists (select 1 from public.food_items fi where fi.id = food_id and fi.user_id = (select auth.uid()))
);
create policy "diet_template_items_update_own" on public.diet_template_items for update using (
  exists (select 1 from public.diet_templates dt where dt.id = template_id and dt.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.diet_templates dt where dt.id = template_id and dt.user_id = (select auth.uid()))
  and exists (select 1 from public.food_items fi where fi.id = food_id and fi.user_id = (select auth.uid()))
);
create policy "diet_template_items_delete_own" on public.diet_template_items for delete using (
  exists (select 1 from public.diet_templates dt where dt.id = template_id and dt.user_id = (select auth.uid()))
);

drop policy if exists "nutrition_targets_select_own" on public.nutrition_targets;
drop policy if exists "nutrition_targets_insert_own" on public.nutrition_targets;
drop policy if exists "nutrition_targets_update_own" on public.nutrition_targets;
drop policy if exists "nutrition_targets_delete_own" on public.nutrition_targets;
create policy "nutrition_targets_select_own" on public.nutrition_targets for select using ((select auth.uid()) = user_id);
create policy "nutrition_targets_insert_own" on public.nutrition_targets for insert with check ((select auth.uid()) = user_id);
create policy "nutrition_targets_update_own" on public.nutrition_targets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "nutrition_targets_delete_own" on public.nutrition_targets for delete using ((select auth.uid()) = user_id);

drop policy if exists "diet_entries_select_own" on public.diet_entries;
drop policy if exists "diet_entries_insert_own" on public.diet_entries;
drop policy if exists "diet_entries_update_own" on public.diet_entries;
drop policy if exists "diet_entries_delete_own" on public.diet_entries;
create policy "diet_entries_select_own" on public.diet_entries for select using ((select auth.uid()) = user_id);
create policy "diet_entries_insert_own" on public.diet_entries for insert with check ((select auth.uid()) = user_id);
create policy "diet_entries_update_own" on public.diet_entries for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "diet_entries_delete_own" on public.diet_entries for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.food_items to authenticated;
grant select, insert, update, delete on public.diet_templates to authenticated;
grant select, insert, update, delete on public.diet_template_items to authenticated;
grant select, insert, update, delete on public.nutrition_targets to authenticated;
grant select, insert, update, delete on public.diet_entries to authenticated;

drop trigger if exists food_items_touch_updated_at on public.food_items;
create trigger food_items_touch_updated_at before update on public.food_items
  for each row execute procedure public.touch_updated_at();
drop trigger if exists diet_templates_touch_updated_at on public.diet_templates;
create trigger diet_templates_touch_updated_at before update on public.diet_templates
  for each row execute procedure public.touch_updated_at();
drop trigger if exists nutrition_targets_touch_updated_at on public.nutrition_targets;
create trigger nutrition_targets_touch_updated_at before update on public.nutrition_targets
  for each row execute procedure public.touch_updated_at();
drop trigger if exists diet_entries_touch_updated_at on public.diet_entries;
create trigger diet_entries_touch_updated_at before update on public.diet_entries
  for each row execute procedure public.touch_updated_at();

-- Historical entries must retain the nutrition values that were true when recorded.
create or replace function public.protect_diet_entry_snapshots()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.source_kind := old.source_kind;
  new.source_id := old.source_id;
  new.group_id := old.group_id;
  new.food_id := old.food_id;
  new.name_snapshot := old.name_snapshot;
  new.standard_amount_snapshot := old.standard_amount_snapshot;
  new.standard_unit_snapshot := old.standard_unit_snapshot;
  new.portion_options_snapshot := old.portion_options_snapshot;
  new.calories_kcal_snapshot := old.calories_kcal_snapshot;
  new.protein_g_snapshot := old.protein_g_snapshot;
  new.carbs_g_snapshot := old.carbs_g_snapshot;
  new.fat_g_snapshot := old.fat_g_snapshot;
  new.fiber_g_snapshot := old.fiber_g_snapshot;
  new.caffeine_mg_snapshot := old.caffeine_mg_snapshot;
  new.estimated := old.estimated;
  return new;
end;
$$;

drop trigger if exists diet_entries_protect_snapshots on public.diet_entries;
create trigger diet_entries_protect_snapshots
  before update on public.diet_entries
  for each row execute procedure public.protect_diet_entry_snapshots();

create or replace function public.add_diet_resource(
  p_record_date date,
  p_meal_slot text,
  p_resource_kind text,
  p_resource_id uuid,
  p_status text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid := gen_random_uuid();
  v_inserted integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_record_date is null then raise exception 'Record date is required'; end if;
  if p_meal_slot not in ('breakfast', 'lunch', 'dinner', 'snack') then raise exception 'Invalid meal slot'; end if;
  if p_status not in ('planned', 'consumed') then raise exception 'Invalid entry status'; end if;

  if p_resource_kind = 'food' then
    insert into public.diet_entries (
      user_id, record_date, meal_slot, status, source_kind, source_id, group_id, food_id,
      name_snapshot, standard_amount_snapshot, standard_unit_snapshot, portion_options_snapshot,
      calories_kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      fiber_g_snapshot, caffeine_mg_snapshot
    )
    select
      v_user_id, p_record_date, p_meal_slot, p_status, 'food', fi.id, v_group_id, fi.id,
      fi.name, fi.standard_amount, fi.standard_unit, fi.common_portions,
      fi.calories_kcal, fi.protein_g, fi.carbs_g, fi.fat_g, fi.fiber_g, fi.caffeine_mg
    from public.food_items fi
    where fi.id = p_resource_id and fi.user_id = v_user_id and not fi.archived;
  elsif p_resource_kind in ('combination', 'menu') then
    insert into public.diet_entries (
      user_id, record_date, meal_slot, status, source_kind, source_id, group_id, food_id,
      name_snapshot, standard_amount_snapshot, standard_unit_snapshot, portion_options_snapshot,
      quantity, calories_kcal_snapshot, protein_g_snapshot, carbs_g_snapshot, fat_g_snapshot,
      fiber_g_snapshot, caffeine_mg_snapshot
    )
    select
      v_user_id, p_record_date, p_meal_slot, p_status, dt.kind, dt.id, v_group_id, fi.id,
      fi.name, fi.standard_amount, fi.standard_unit, fi.common_portions,
      dti.portion_multiplier, fi.calories_kcal, fi.protein_g, fi.carbs_g, fi.fat_g,
      fi.fiber_g, fi.caffeine_mg
    from public.diet_templates dt
    join public.diet_template_items dti on dti.template_id = dt.id
    join public.food_items fi on fi.id = dti.food_id and fi.user_id = v_user_id
    where dt.id = p_resource_id and dt.user_id = v_user_id
      and dt.kind = p_resource_kind and not dt.archived
    order by dti.sort_order, dti.created_at;
  else
    raise exception 'Invalid resource kind';
  end if;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then raise exception 'Diet resource was not found or is empty'; end if;
  return v_inserted;
end;
$$;

create or replace function public.save_diet_template_from_entries(
  p_name text,
  p_kind text,
  p_tags text[],
  p_entry_ids uuid[],
  p_template_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_item_count integer;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_kind not in ('combination', 'menu') then raise exception 'Invalid template kind'; end if;
  if length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'Template name is required'; end if;
  if cardinality(coalesce(p_entry_ids, array[]::uuid[])) = 0 then raise exception 'Select at least one food'; end if;

  if p_template_id is null then
    insert into public.diet_templates (user_id, kind, name, tags)
    values (v_user_id, p_kind, trim(p_name), coalesce(p_tags, array[]::text[]))
    returning id into v_template_id;
  else
    update public.diet_templates
    set kind = p_kind, name = trim(p_name), tags = coalesce(p_tags, array[]::text[])
    where id = p_template_id and user_id = v_user_id
    returning id into v_template_id;
    if v_template_id is null then raise exception 'Template was not found'; end if;
    delete from public.diet_template_items where template_id = v_template_id;
  end if;

  insert into public.diet_template_items (template_id, food_id, portion_multiplier, sort_order)
  select v_template_id, de.food_id, sum(de.quantity), row_number() over (order by min(de.created_at)) - 1
  from public.diet_entries de
  where de.user_id = v_user_id
    and de.id = any(p_entry_ids)
    and de.food_id is not null
  group by de.food_id;
  get diagnostics v_item_count = row_count;

  if v_item_count = 0 then raise exception 'Selected entries do not reference reusable foods'; end if;
  return v_template_id;
end;
$$;

revoke all on function public.add_diet_resource(date, text, text, uuid, text) from public;
grant execute on function public.add_diet_resource(date, text, text, uuid, text) to authenticated;
revoke all on function public.save_diet_template_from_entries(text, text, text[], uuid[], uuid) from public;
grant execute on function public.save_diet_template_from_entries(text, text, text[], uuid[], uuid) to authenticated;
