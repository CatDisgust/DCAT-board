import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoBodyMeasurements, demoProfile, demoRecords } from "@/lib/demo-data";
import { demoDietEntries, demoDietTemplates, demoFoods, demoNutritionTargets } from "@/lib/diet-demo";
import { recordDateOr } from "@/lib/record-date";
import type {
  BodyMeasurement,
  DailyRecord,
  DietEntry,
  DietTemplate,
  DietTemplateItem,
  FoodItem,
  HealthConnection,
  NutritionTargets,
  Profile,
} from "@/lib/types";
import { todayInTimeZone } from "@/lib/user-date";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = process.env.ALLOWED_USER_EMAIL?.toLowerCase();
  if (allowed && user.email?.toLowerCase() !== allowed) redirect("/login?error=not_allowed");
  return { supabase, user };
}

export async function getAppData(limit = 28): Promise<{
  demo: boolean;
  profile: Profile;
  records: DailyRecord[];
}> {
  if (!isSupabaseConfigured()) {
    return { demo: true, profile: demoProfile, records: demoRecords.slice(-limit) };
  }

  const { supabase, user } = await authenticatedClient();

  const [{ data: profileData }, { data: recordsData, error }] = await Promise.all([
    supabase.from("profiles").select("timezone,boundary_time,weight_unit,energy_unit,ai_analysis_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("daily_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(limit),
  ]);
  if (error) throw new Error(error.message);

  const profile: Profile = {
    email: user.email,
    timezone: profileData?.timezone ?? "Australia/Sydney",
    boundary_time: profileData?.boundary_time ?? "20:00",
    weight_unit: profileData?.weight_unit ?? "kg",
    energy_unit: profileData?.energy_unit ?? "kcal",
    ai_analysis_enabled: profileData?.ai_analysis_enabled ?? true,
  };
  return { demo: false, profile, records: (recordsData ?? []).reverse() as DailyRecord[] };
}

export async function getRecordPageData(requestedDate?: string) {
  if (!isSupabaseConfigured()) {
    const date = recordDateOr(requestedDate, todayInTimeZone(demoProfile.timezone));
    const slots = new Set(demoDietEntries
      .filter((entry) => entry.record_date === date && entry.status === "consumed")
      .map((entry) => entry.meal_slot));
    return {
      demo: true,
      date,
      record: demoRecords.find((item) => item.record_date === date) ?? null,
      hasDetailedDiet: slots.size > 0,
      detailedMealCount: slots.size,
    };
  }
  const { supabase, user } = await authenticatedClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const date = recordDateOr(requestedDate, todayInTimeZone(profileData?.timezone ?? "Australia/Sydney"));
  const [recordResult, dietResult] = await Promise.all([
    supabase.from("daily_records").select("*").eq("user_id", user.id).eq("record_date", date).maybeSingle(),
    supabase.from("diet_entries").select("meal_slot").eq("user_id", user.id).eq("record_date", date).eq("status", "consumed"),
  ]);
  const error = recordResult.error ?? dietResult.error;
  if (error) throw new Error(error.message);
  const slots = new Set((dietResult.data ?? []).map((entry) => entry.meal_slot));
  return {
    demo: false,
    date,
    record: recordResult.data as DailyRecord | null,
    hasDetailedDiet: slots.size > 0,
    detailedMealCount: slots.size,
  };
}

export async function getAnalysisPageData(recordLimit = 35) {
  if (!isSupabaseConfigured()) {
    return {
      demo: true,
      profile: demoProfile,
      records: demoRecords.slice(-recordLimit),
      dietEntries: demoDietEntries,
      nutritionTargets: demoNutritionTargets,
    };
  }
  const { supabase, user } = await authenticatedClient();
  const [profileResult, recordsResult, dietResult, targetResult] = await Promise.all([
    supabase.from("profiles").select("timezone,boundary_time,weight_unit,energy_unit,ai_analysis_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("daily_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(recordLimit),
    supabase.from("diet_entries").select("*").eq("user_id", user.id).eq("status", "consumed").order("record_date", { ascending: false }).limit(1000),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const error = profileResult.error ?? recordsResult.error ?? dietResult.error ?? targetResult.error;
  if (error) throw new Error(error.message);
  return {
    demo: false,
    profile: {
      email: user.email,
      timezone: profileResult.data?.timezone ?? "Australia/Sydney",
      boundary_time: profileResult.data?.boundary_time ?? "20:00",
      weight_unit: profileResult.data?.weight_unit ?? "kg",
      energy_unit: profileResult.data?.energy_unit ?? "kcal",
      ai_analysis_enabled: profileResult.data?.ai_analysis_enabled ?? true,
    } as Profile,
    records: (recordsResult.data ?? []).reverse() as DailyRecord[],
    dietEntries: (dietResult.data ?? []).reverse() as DietEntry[],
    nutritionTargets: normalizeNutritionTargets(targetResult.data),
  };
}

const emptyNutritionTargets = (): NutritionTargets => ({
  calories_kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  fiber_g: null,
  caffeine_mg: null,
  resting_metabolism_kcal: 1600,
  calorie_deficit_kcal: 300,
});

const normalizeNutritionTargets = (value: Partial<NutritionTargets> | null | undefined): NutritionTargets => ({
  ...emptyNutritionTargets(),
  ...value,
  resting_metabolism_kcal: value?.resting_metabolism_kcal ?? 1600,
  calorie_deficit_kcal: value?.calorie_deficit_kcal ?? 300,
});

const normalizeFood = (food: FoodItem): FoodItem => ({
  ...food,
  tags: food.tags ?? [],
  common_portions: food.common_portions ?? [],
});

export async function getHomePageData(recordLimit = 28) {
  if (!isSupabaseConfigured()) {
    const today = todayInTimeZone(demoProfile.timezone);
    return {
      demo: true,
      profile: demoProfile,
      records: demoRecords.slice(-recordLimit),
      dietEntries: demoDietEntries.filter((entry) => entry.record_date === today && entry.status === "consumed"),
      nutritionTargets: demoNutritionTargets,
    };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("timezone,boundary_time,weight_unit,energy_unit,ai_analysis_enabled")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const profile: Profile = {
    email: user.email,
    timezone: profileData?.timezone ?? "Australia/Sydney",
    boundary_time: profileData?.boundary_time ?? "20:00",
    weight_unit: profileData?.weight_unit ?? "kg",
    energy_unit: profileData?.energy_unit ?? "kcal",
    ai_analysis_enabled: profileData?.ai_analysis_enabled ?? true,
  };
  const today = todayInTimeZone(profile.timezone);
  const [recordsResult, dietResult, targetResult] = await Promise.all([
    supabase.from("daily_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(recordLimit),
    supabase.from("diet_entries").select("*").eq("user_id", user.id).eq("record_date", today).eq("status", "consumed").order("created_at"),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const error = recordsResult.error ?? dietResult.error ?? targetResult.error;
  if (error) throw new Error(error.message);

  return {
    demo: false,
    profile,
    records: (recordsResult.data ?? []).reverse() as DailyRecord[],
    dietEntries: (dietResult.data ?? []) as DietEntry[],
    nutritionTargets: normalizeNutritionTargets(targetResult.data),
  };
}

export async function getDietPageData(requestedDate?: string) {
  if (!isSupabaseConfigured()) {
    const today = todayInTimeZone(demoProfile.timezone);
    const date = recordDateOr(requestedDate, today);
    return {
      demo: true,
      date,
      today,
      foods: demoFoods,
      templates: demoDietTemplates,
      entries: demoDietEntries.filter((entry) => entry.record_date === date),
      targets: demoNutritionTargets,
      currentWeight: [...demoRecords].reverse().find((record) => record.weight !== null)?.weight ?? null,
      currentWeightDate: [...demoRecords].reverse().find((record) => record.weight !== null)?.record_date ?? null,
      activeEnergyKcal: demoRecords.find((record) => record.record_date === date)?.active_energy_kcal ?? null,
    };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const today = todayInTimeZone(profileData?.timezone ?? "Australia/Sydney");
  const date = recordDateOr(requestedDate, today);

  const [foodResult, templateResult, templateItemResult, entryResult, targetResult, weightResult, energyResult] = await Promise.all([
    supabase.from("food_items").select("*").eq("user_id", user.id).order("archived").order("name"),
    supabase.from("diet_templates").select("*").eq("user_id", user.id).order("archived").order("name"),
    supabase.from("diet_template_items").select("*").order("sort_order"),
    supabase.from("diet_entries").select("*").eq("user_id", user.id).eq("record_date", date).order("created_at"),
    supabase.from("nutrition_targets").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("daily_records").select("weight,record_date").eq("user_id", user.id).not("weight", "is", null).lte("record_date", today).order("record_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_records").select("active_energy_kcal").eq("user_id", user.id).eq("record_date", date).maybeSingle(),
  ]);
  const error = foodResult.error ?? templateResult.error ?? templateItemResult.error ?? entryResult.error ?? targetResult.error ?? weightResult.error ?? energyResult.error;
  if (error) throw new Error(error.message);

  const foods = ((foodResult.data ?? []) as FoodItem[]).map(normalizeFood);
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const items = (templateItemResult.data ?? []) as DietTemplateItem[];
  const templates = ((templateResult.data ?? []) as Omit<DietTemplate, "items">[]).map((template) => ({
    ...template,
    tags: template.tags ?? [],
    items: items
      .filter((item) => item.template_id === template.id)
      .map((item) => ({ ...item, food: foodById.get(item.food_id) })),
  }));

  return {
    demo: false,
    date,
    today,
    foods,
    templates,
    entries: (entryResult.data ?? []) as DietEntry[],
    targets: normalizeNutritionTargets(targetResult.data),
    currentWeight: weightResult.data?.weight ?? null,
    currentWeightDate: weightResult.data?.record_date ?? null,
    activeEnergyKcal: energyResult.data?.active_energy_kcal ?? null,
  };
}

export async function getBodyPageData(requestedDate?: string) {
  if (!isSupabaseConfigured()) {
    const date = recordDateOr(requestedDate, todayInTimeZone(demoProfile.timezone));
    const measurement = demoBodyMeasurements.find((item) => item.measurement_date === date) ?? null;
    const previousMeasurement = [...demoBodyMeasurements]
      .filter((item) => item.measurement_date < date)
      .sort((a, b) => b.measurement_date.localeCompare(a.measurement_date))[0] ?? null;
    return {
      demo: true,
      date,
      record: demoRecords.find((item) => item.record_date === date) ?? null,
      measurement,
      previousMeasurement,
      measurements: demoBodyMeasurements.slice(-12),
      records: demoRecords.slice(-35),
    };
  }

  const { supabase, user } = await authenticatedClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const date = recordDateOr(requestedDate, todayInTimeZone(profileData?.timezone ?? "Australia/Sydney"));
  const [recordResult, measurementResult, previousResult, recentResult, recordsResult] = await Promise.all([
    supabase.from("daily_records").select("*").eq("user_id", user.id).eq("record_date", date).maybeSingle(),
    supabase.from("body_measurements").select("*").eq("user_id", user.id).eq("measurement_date", date).maybeSingle(),
    supabase.from("body_measurements").select("*").eq("user_id", user.id).lt("measurement_date", date).order("measurement_date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("body_measurements").select("*").eq("user_id", user.id).order("measurement_date", { ascending: false }).limit(12),
    supabase.from("daily_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(35),
  ]);
  const error = recordResult.error ?? measurementResult.error ?? previousResult.error ?? recentResult.error ?? recordsResult.error;
  if (error) throw new Error(error.message);
  return {
    demo: false,
    date,
    record: recordResult.data as DailyRecord | null,
    measurement: measurementResult.data as BodyMeasurement | null,
    previousMeasurement: previousResult.data as BodyMeasurement | null,
    measurements: (recentResult.data ?? []).reverse() as BodyMeasurement[],
    records: (recordsResult.data ?? []).reverse() as DailyRecord[],
  };
}

export async function getHistoryDetailData(date: string): Promise<{ demo: boolean; record: DailyRecord | null; measurement: BodyMeasurement | null }> {
  if (!isSupabaseConfigured()) {
    return {
      demo: true,
      record: demoRecords.find((item) => item.record_date === date) ?? null,
      measurement: demoBodyMeasurements.find((item) => item.measurement_date === date) ?? null,
    };
  }
  const { supabase, user } = await authenticatedClient();
  const [recordResult, measurementResult] = await Promise.all([
    supabase.from("daily_records").select("*").eq("user_id", user.id).eq("record_date", date).maybeSingle(),
    supabase.from("body_measurements").select("*").eq("user_id", user.id).eq("measurement_date", date).maybeSingle(),
  ]);
  const error = recordResult.error ?? measurementResult.error;
  if (error) throw new Error(error.message);
  return {
    demo: false,
    record: recordResult.data as DailyRecord | null,
    measurement: measurementResult.data as BodyMeasurement | null,
  };
}

export async function getHealthConnectionStatus(): Promise<{ demo: boolean; connection: HealthConnection }> {
  const disconnected: HealthConnection = {
    connected: false,
    deviceName: null,
    lastSyncedAt: null,
    lastSuccessAt: null,
    lastError: null,
    permissions: {},
  };
  if (!isSupabaseConfigured()) return { demo: true, connection: disconnected };

  const { supabase, user } = await authenticatedClient();

  const { data, error } = await supabase
    .from("health_sync_devices")
    .select("device_name,last_synced_at,last_success_at,last_error,permissions")
    .eq("user_id", user.id)
    .order("last_success_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    demo: false,
    connection: data ? {
      connected: Boolean(data.last_success_at),
      deviceName: data.device_name,
      lastSyncedAt: data.last_synced_at,
      lastSuccessAt: data.last_success_at,
      lastError: data.last_error,
      permissions: (data.permissions ?? {}) as Record<string, unknown>,
    } : disconnected,
  };
}
