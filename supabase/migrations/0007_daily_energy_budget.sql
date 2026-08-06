-- User-controlled energy budget inputs. Daily calorie targets are derived from
-- resting metabolism + synced active energy - calorie deficit.
alter table public.nutrition_targets
  add column if not exists resting_metabolism_kcal numeric(9,2) not null default 1600
    check (resting_metabolism_kcal > 0 and resting_metabolism_kcal <= 10000),
  add column if not exists calorie_deficit_kcal numeric(9,2) not null default 300
    check (calorie_deficit_kcal >= 0 and calorie_deficit_kcal <= 5000);
