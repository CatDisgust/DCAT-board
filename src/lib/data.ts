import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoProfile, demoRecords } from "@/lib/demo-data";
import type { DailyRecord, HealthConnection, Profile } from "@/lib/types";

export async function getAppData(limit = 28): Promise<{
  demo: boolean;
  profile: Profile;
  records: DailyRecord[];
}> {
  if (!isSupabaseConfigured()) {
    return { demo: true, profile: demoProfile, records: demoRecords.slice(-limit) };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = process.env.ALLOWED_USER_EMAIL?.toLowerCase();
  if (allowed && user.email?.toLowerCase() !== allowed) redirect("/login?error=not_allowed");

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

export async function getRecord(date: string) {
  if (!isSupabaseConfigured()) {
    return { demo: true, record: demoRecords.find((item) => item.record_date === date) ?? null };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = process.env.ALLOWED_USER_EMAIL?.toLowerCase();
  if (allowed && user.email?.toLowerCase() !== allowed) redirect("/login?error=not_allowed");

  const { data, error } = await supabase
    .from("daily_records")
    .select("*")
    .eq("user_id", user.id)
    .eq("record_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { demo: false, record: data as DailyRecord | null };
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
