import { format, subDays } from "date-fns";
import type { DailyRecord, Profile } from "./types";

const today = new Date();
const weights = [72.9, 72.8, 72.7, 72.8, 72.5, 72.4, 72.3, 72.1, 72.2, 72.0, 71.9, 71.8, 71.9, 71.7];

export const demoRecords: DailyRecord[] = Array.from({ length: 14 }, (_, index) => {
  const daysAgo = 13 - index;
  const violated = [2, 6, 9, 12].includes(index);
  const isToday = daysAgo === 0;
  return {
    record_date: format(subDays(today, daysAgo), "yyyy-MM-dd"),
    morning_completed_at: new Date().toISOString(),
    evening_completed_at: isToday ? null : new Date().toISOString(),
    weight: weights[index],
    sleep_start_time: violated ? "00:42" : index % 3 === 0 ? "23:38" : "23:18",
    sleep_duration_minutes: violated ? 378 : 432 + (index % 3) * 12,
    wake_time: violated ? "07:05" : "07:02",
    sleep_source: "manual",
    sleep_start_at: null,
    sleep_end_at: null,
    sleep_quality: violated ? "poor" : index % 4 === 0 ? "average" : "good",
    morning_clarity: violated ? "tired" : index % 3 === 0 ? "normal" : "clear",
    task_intensity: violated ? "low" : index % 3 === 0 ? "medium" : "high",
    active_energy_kcal: isToday ? null : 410 + index * 17,
    meal_count: isToday ? null : 3,
    had_large_meal: isToday ? null : [3, 10].includes(index),
    overeating: isToday ? null : [3, 10].includes(index),
    late_night_eating: isToday ? null : [6].includes(index),
    high_fat_sugar_level: isToday ? null : [3, 10].includes(index) ? "significant" : "small",
    protein_level: isToday ? null : index % 4 === 0 ? "roughly_enough" : "sufficient",
    vegetable_level: isToday ? null : index % 5 === 0 ? "insufficient" : "roughly_enough",
    carbohydrate_amount: isToday ? null : [3, 10].includes(index) ? "high" : "moderate",
    overall_intake: isToday ? null : [3, 10].includes(index) ? "high" : "moderate",
    hunger_affected_sleep: isToday ? null : false,
    boundary_violated: isToday ? null : violated,
    boundary_violation_reason: violated ? "new_idea_to_validate" : null,
    boundary_other_note: null,
    thoughts_expanding_at_night: isToday ? null : violated,
  };
});

export const demoProfile: Profile = {
  email: "demo@personal-dashboard.app",
  timezone: "Australia/Sydney",
  boundary_time: "20:00",
  weight_unit: "kg",
  energy_unit: "kcal",
  ai_analysis_enabled: true,
};
