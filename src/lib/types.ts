export type SleepQuality = "very_poor" | "poor" | "average" | "good" | "very_good";
export type MorningClarity = "heavy_brain_fog" | "tired" | "normal" | "clear" | "very_clear";
export type TaskIntensity = "low" | "medium" | "high";
export type ThreeLevel = "insufficient" | "roughly_enough" | "sufficient";
export type FatSugarLevel = "none" | "small" | "significant";
export type CarbAmount = "low" | "moderate" | "high";
export type OverallIntake = "low" | "moderate" | "high" | "excessive";
export type SleepSource = "manual" | "apple_health";
export type HealthValueSource = "manual" | "apple_health";

export type DailyRecord = {
  id?: string;
  user_id?: string;
  record_date: string;
  morning_completed_at: string | null;
  evening_completed_at: string | null;
  weight: number | null;
  weight_source: HealthValueSource | null;
  body_fat_percentage: number | null;
  body_fat_source: HealthValueSource | null;
  sleep_start_time: string | null;
  sleep_duration_minutes: number | null;
  wake_time: string | null;
  sleep_source: SleepSource | null;
  sleep_start_at: string | null;
  sleep_end_at: string | null;
  sleep_quality: SleepQuality | null;
  morning_clarity: MorningClarity | null;
  task_intensity: TaskIntensity | null;
  active_energy_kcal: number | null;
  active_energy_source: HealthValueSource | null;
  health_updated_at: string | null;
  meal_count: number | null;
  had_large_meal: boolean | null;
  overeating: boolean | null;
  late_night_eating: boolean | null;
  high_fat_sugar_level: FatSugarLevel | null;
  protein_level: ThreeLevel | null;
  vegetable_level: ThreeLevel | null;
  carbohydrate_amount: CarbAmount | null;
  overall_intake: OverallIntake | null;
  hunger_affected_sleep: boolean | null;
  boundary_violated: boolean | null;
  boundary_violation_reason: string | null;
  boundary_other_note: string | null;
  thoughts_expanding_at_night: boolean | null;
};

export type BodyMeasurement = {
  id?: string;
  user_id?: string;
  measurement_date: string;
  chest_cm: number;
  waist_cm: number;
  hip_cm: number;
  created_at?: string;
  updated_at?: string;
};

export type Profile = {
  email?: string | null;
  timezone: string;
  boundary_time: string;
  weight_unit: "kg" | "lb";
  energy_unit: "kcal" | "kj";
  ai_analysis_enabled: boolean;
};

export type HealthConnection = {
  connected: boolean;
  deviceName: string | null;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  permissions: Record<string, unknown>;
};

export const emptyRecord = (date: string): DailyRecord => ({
  record_date: date,
  morning_completed_at: null,
  evening_completed_at: null,
  weight: null,
  weight_source: null,
  body_fat_percentage: null,
  body_fat_source: null,
  sleep_start_time: null,
  sleep_duration_minutes: null,
  wake_time: null,
  sleep_source: null,
  sleep_start_at: null,
  sleep_end_at: null,
  sleep_quality: null,
  morning_clarity: null,
  task_intensity: null,
  active_energy_kcal: null,
  active_energy_source: null,
  health_updated_at: null,
  meal_count: null,
  had_large_meal: null,
  overeating: null,
  late_night_eating: null,
  high_fat_sugar_level: null,
  protein_level: null,
  vegetable_level: null,
  carbohydrate_amount: null,
  overall_intake: null,
  hunger_affected_sleep: null,
  boundary_violated: null,
  boundary_violation_reason: null,
  boundary_other_note: null,
  thoughts_expanding_at_night: null,
});
