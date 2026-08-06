"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { calculateSleepDurationMinutes } from "@/lib/sleep";
import { isRecordDate } from "@/lib/record-date";

const nullableString = (form: FormData, key: string) => {
  const value = form.get(key)?.toString().trim();
  return value ? value : null;
};
const nullableNumber = (form: FormData, key: string) => {
  const value = nullableString(form, key);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const nullableBoolean = (form: FormData, key: string) => {
  const value = nullableString(form, key);
  return value === null ? null : value === "true";
};

const requiredNumber = (form: FormData, key: string, min: number, max: number, message: string) => {
  const value = nullableNumber(form, key);
  if (value === null || value < min || value > max) throw new Error(message);
  return value;
};

const bodyCompositionInput = (formData: FormData) => {
  const weightMode = nullableString(formData, "weight_entry_mode") === "manual" ? "manual" : "health";
  const bodyFatMode = nullableString(formData, "body_fat_entry_mode") === "manual" ? "manual" : "health";
  const weight = nullableNumber(formData, "weight");
  const bodyFat = nullableNumber(formData, "body_fat_percentage");
  if (weightMode === "manual" && (weight === null || weight < 20 || weight > 300)) {
    throw new Error("手动修正体重时，需要填写 20–300 kg 的有效数值");
  }
  if (bodyFatMode === "manual" && (bodyFat === null || bodyFat < 0 || bodyFat > 100)) {
    throw new Error("手动修正体脂时，需要填写 0–100% 的有效数值");
  }
  return {
    payload: {
      ...(weightMode === "manual" ? { weight, weight_source: "manual" } : {}),
      ...(bodyFatMode === "manual" ? { body_fat_percentage: bodyFat, body_fat_source: "manual" } : {}),
    },
    releasedSources: {
      ...(weightMode === "health" ? { weight_source: null } : {}),
      ...(bodyFatMode === "health" ? { body_fat_source: null } : {}),
    },
    usesHealth: weightMode === "health" || bodyFatMode === "health",
    hasManual: weightMode === "manual" || bodyFatMode === "manual",
  };
};

async function releaseAndRefreshHealth(
  auth: Awaited<ReturnType<typeof authenticatedClient>>,
  recordDate: string,
  releasedSources: Record<string, null>,
) {
  if (!auth) return;
  if (Object.keys(releasedSources).length > 0) {
    const { error } = await auth.supabase
      .from("daily_records")
      .update(releasedSources)
      .eq("user_id", auth.user.id)
      .eq("record_date", recordDate);
    if (error) throw new Error(error.message);
  }
  const { error } = await auth.supabase.rpc("refresh_health_daily_records", {
    p_user_id: auth.user.id,
    p_dates: [recordDate],
  });
  if (error) throw new Error(error.message);
}

async function authenticatedClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function signIn(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/");
  const email = nullableString(formData, "email");
  if (!email) redirect("/login?error=email");
  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/login?sent=${encodeURIComponent(email)}`);
}

export async function saveMorning(formData: FormData) {
  const auth = await authenticatedClient();
  if (!auth) redirect("/?demo=1");
  const recordDate = nullableString(formData, "record_date");
  if (!isRecordDate(recordDate)) throw new Error("记录日期无效");
  const sleepStartTime = nullableString(formData, "sleep_start_time");
  const wakeTime = nullableString(formData, "wake_time");
  const sleepEntryMode = nullableString(formData, "sleep_entry_mode") === "manual" ? "manual" : "health";
  const bodyComposition = bodyCompositionInput(formData);
  const sleepDuration = calculateSleepDurationMinutes(sleepStartTime, wakeTime);
  if (sleepEntryMode === "manual" && (!sleepStartTime || !wakeTime || sleepDuration === null)) {
    throw new Error("手动修正睡眠时，需要填写有效且不同的入睡和起床时间");
  }
  const payload = {
    user_id: auth.user.id,
    record_date: recordDate,
    morning_completed_at: new Date().toISOString(),
    ...bodyComposition.payload,
    ...(sleepEntryMode === "manual" ? {
      sleep_start_time: sleepStartTime,
      sleep_duration_minutes: sleepDuration,
      wake_time: wakeTime,
      sleep_source: "manual",
      sleep_start_at: null,
      sleep_end_at: null,
    } : {}),
    sleep_quality: nullableString(formData, "sleep_quality"),
    morning_clarity: nullableString(formData, "morning_clarity"),
    task_intensity: nullableString(formData, "task_intensity"),
  };
  const { error } = await auth.supabase.from("daily_records").upsert(payload, { onConflict: "user_id,record_date" });
  if (error) throw new Error(error.message);
  if (sleepEntryMode === "health" || bodyComposition.usesHealth) {
    const releasedSources = {
      ...(sleepEntryMode === "health" ? { sleep_source: null } : {}),
      ...bodyComposition.releasedSources,
    };
    await releaseAndRefreshHealth(auth, recordDate, releasedSources);
  }
  revalidatePath("/"); revalidatePath("/analysis"); revalidatePath("/history"); revalidatePath("/body");
  revalidatePath("/morning");
  revalidatePath(`/history/${recordDate}`);
  redirect("/?saved=morning");
}

export async function saveBodyComposition(formData: FormData) {
  const auth = await authenticatedClient();
  if (!auth) redirect("/body?demo=1");
  const recordDate = nullableString(formData, "record_date");
  if (!isRecordDate(recordDate)) throw new Error("记录日期无效");
  const bodyComposition = bodyCompositionInput(formData);

  if (bodyComposition.hasManual) {
    const { error } = await auth.supabase.from("daily_records").upsert({
      user_id: auth.user.id,
      record_date: recordDate,
      ...bodyComposition.payload,
    }, { onConflict: "user_id,record_date" });
    if (error) throw new Error(error.message);
  }
  if (bodyComposition.usesHealth) {
    await releaseAndRefreshHealth(auth, recordDate, bodyComposition.releasedSources);
  }

  revalidatePath("/"); revalidatePath("/analysis"); revalidatePath("/history"); revalidatePath("/morning"); revalidatePath("/body");
  revalidatePath(`/history/${recordDate}`);
  redirect(`/body?date=${recordDate}&saved=composition`);
}

export async function saveBodyMeasurement(formData: FormData) {
  const auth = await authenticatedClient();
  if (!auth) redirect("/body?demo=1");
  const measurementDate = nullableString(formData, "measurement_date");
  if (!isRecordDate(measurementDate)) throw new Error("测量日期无效");
  const payload = {
    user_id: auth.user.id,
    measurement_date: measurementDate,
    chest_cm: requiredNumber(formData, "chest_cm", 1, 300, "胸围需要填写 1–300 cm 的有效数值"),
    waist_cm: requiredNumber(formData, "waist_cm", 1, 300, "腰围需要填写 1–300 cm 的有效数值"),
    hip_cm: requiredNumber(formData, "hip_cm", 1, 300, "臀围需要填写 1–300 cm 的有效数值"),
  };
  const { error } = await auth.supabase.from("body_measurements").upsert(payload, { onConflict: "user_id,measurement_date" });
  if (error) throw new Error(error.message);

  revalidatePath("/body"); revalidatePath("/analysis"); revalidatePath("/history");
  revalidatePath(`/history/${measurementDate}`);
  redirect(`/body?date=${measurementDate}&saved=measurement`);
}

export async function saveEvening(formData: FormData) {
  const auth = await authenticatedClient();
  if (!auth) redirect("/?demo=1");
  const recordDate = nullableString(formData, "record_date");
  if (!isRecordDate(recordDate)) throw new Error("记录日期无效");
  const violated = nullableBoolean(formData, "boundary_violated");
  const reason = nullableString(formData, "boundary_violation_reason");
  const activeEnergyEntryMode = nullableString(formData, "active_energy_entry_mode") === "manual" ? "manual" : "health";
  const activeEnergy = nullableNumber(formData, "active_energy_kcal");
  if (activeEnergyEntryMode === "manual" && activeEnergy === null) {
    throw new Error("手动修正活动能量时，需要填写有效数值");
  }
  if (violated && !reason) throw new Error("违反边界时需要选择主要原因");
  const { data: detailedDiet, error: detailedDietError } = await auth.supabase
    .from("diet_entries")
    .select("meal_slot")
    .eq("user_id", auth.user.id)
    .eq("record_date", recordDate)
    .eq("status", "consumed");
  if (detailedDietError) throw new Error(detailedDietError.message);
  const detailedMealCount = new Set((detailedDiet ?? []).map((entry) => entry.meal_slot)).size;
  const hasDetailedDiet = detailedMealCount > 0;
  const legacyDietPayload = hasDetailedDiet ? {} : {
    high_fat_sugar_level: nullableString(formData, "high_fat_sugar_level"),
    protein_level: nullableString(formData, "protein_level"),
    vegetable_level: nullableString(formData, "vegetable_level"),
    carbohydrate_amount: nullableString(formData, "carbohydrate_amount"),
    overall_intake: nullableString(formData, "overall_intake"),
  };
  const payload: Record<string, unknown> = {
    user_id: auth.user.id,
    record_date: recordDate,
    evening_completed_at: new Date().toISOString(),
    ...(activeEnergyEntryMode === "manual" ? {
      active_energy_kcal: activeEnergy,
      active_energy_source: "manual",
    } : {}),
    meal_count: hasDetailedDiet ? detailedMealCount : nullableNumber(formData, "meal_count"),
    had_large_meal: nullableBoolean(formData, "had_large_meal"),
    overeating: nullableBoolean(formData, "overeating"),
    late_night_eating: nullableBoolean(formData, "late_night_eating"),
    ...legacyDietPayload,
    hunger_affected_sleep: nullableBoolean(formData, "hunger_affected_sleep"),
    boundary_violated: violated,
    boundary_violation_reason: violated ? reason : null,
    boundary_other_note: reason === "other" ? nullableString(formData, "boundary_other_note") : null,
    thoughts_expanding_at_night: nullableBoolean(formData, "thoughts_expanding_at_night"),
  };
  const { error } = await auth.supabase.from("daily_records").upsert(payload, { onConflict: "user_id,record_date" });
  if (error) throw new Error(error.message);
  if (activeEnergyEntryMode === "health") {
    const { error: releaseError } = await auth.supabase
      .from("daily_records")
      .update({ active_energy_source: null })
      .eq("user_id", auth.user.id)
      .eq("record_date", recordDate);
    if (releaseError) throw new Error(releaseError.message);

    const { error: refreshError } = await auth.supabase.rpc("refresh_health_daily_records", {
      p_user_id: auth.user.id,
      p_dates: [recordDate],
    });
    if (refreshError) throw new Error(refreshError.message);
  }
  revalidatePath("/"); revalidatePath("/analysis"); revalidatePath("/history"); revalidatePath("/diet");
  revalidatePath("/evening");
  revalidatePath(`/history/${recordDate}`);
  redirect("/?saved=evening");
}

export async function saveSettings(formData: FormData) {
  const auth = await authenticatedClient();
  if (!auth) redirect("/settings?demo=1");
  const payload = {
    user_id: auth.user.id,
    timezone: nullableString(formData, "timezone") ?? "Australia/Sydney",
    boundary_time: nullableString(formData, "boundary_time") ?? "20:00",
    weight_unit: nullableString(formData, "weight_unit") ?? "kg",
    energy_unit: nullableString(formData, "energy_unit") ?? "kcal",
    ai_analysis_enabled: formData.get("ai_analysis_enabled") === "on",
    updated_at: new Date().toISOString(),
  };
  const { error } = await auth.supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function deleteAccount(formData: FormData) {
  if (formData.get("confirmation") !== "DELETE") redirect("/settings?delete_error=confirmation");
  const auth = await authenticatedClient();
  if (!auth) redirect("/settings?demo=1");
  const { error } = await auth.supabase.rpc("delete_own_account");
  if (error) redirect(`/settings?delete_error=${encodeURIComponent(error.message)}`);
  await auth.supabase.auth.signOut();
  redirect("/login?deleted=1");
}
