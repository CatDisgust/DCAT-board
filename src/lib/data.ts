import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoBodyMeasurements, demoProfile, demoRecords } from "@/lib/demo-data";
import { recordDateOr } from "@/lib/record-date";
import type { BodyMeasurement, DailyRecord, HealthConnection, Profile } from "@/lib/types";
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
    return { demo: true, date, record: demoRecords.find((item) => item.record_date === date) ?? null };
  }
  const { supabase, user } = await authenticatedClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  const date = recordDateOr(requestedDate, todayInTimeZone(profileData?.timezone ?? "Australia/Sydney"));
  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("user_id", user.id)
    .eq("record_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { demo: false, date, record: data as DailyRecord | null };
}

export async function getAnalysisPageData(recordLimit = 35) {
  if (!isSupabaseConfigured()) {
    return {
      demo: true,
      profile: demoProfile,
      records: demoRecords.slice(-recordLimit),
    };
  }
  const { supabase, user } = await authenticatedClient();
  const [profileResult, recordsResult] = await Promise.all([
    supabase.from("profiles").select("timezone,boundary_time,weight_unit,energy_unit,ai_analysis_enabled").eq("user_id", user.id).maybeSingle(),
    supabase.from("daily_records").select("*").eq("user_id", user.id).order("record_date", { ascending: false }).limit(recordLimit),
  ]);
  const error = profileResult.error ?? recordsResult.error;
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
