"use server";

import { revalidatePath } from "next/cache";
import { defaultDietStatus } from "@/lib/diet";
import { isRecordDate } from "@/lib/record-date";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type {
  DietEntry,
  DietEntryStatus,
  DietTemplateKind,
  FoodItem,
  FoodPortion,
  MealSlot,
  NutritionTargets,
} from "@/lib/types";
import { todayInTimeZone } from "@/lib/user-date";

export type DietActionResult = { ok: true; id?: string } | { ok: false; error: string };

const fail = (error: unknown): DietActionResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "保存失败，请稍后重试",
});

async function dietAuth() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const allowed = process.env.ALLOWED_USER_EMAIL?.toLowerCase();
  if (allowed && user.email?.toLowerCase() !== allowed) return null;
  return { supabase, user };
}

function refreshDiet(date?: string) {
  revalidatePath("/");
  revalidatePath("/diet");
  revalidatePath("/analysis");
  revalidatePath("/evening");
  revalidatePath("/history");
  if (date) revalidatePath(`/history/${date}`);
}

const finite = (value: number | null | undefined, label: string, required = false) => {
  if (value === null || value === undefined) {
    if (required) throw new Error(`${label}不能为空`);
    return null;
  }
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}需要是大于或等于 0 的有效数值`);
  return Number(value);
};

const cleanTags = (tags: string[]) => [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);

const cleanPortions = (portions: FoodPortion[]) => portions.map((portion) => ({
  label: portion.label.trim(),
  multiplier: Number(portion.multiplier),
})).filter((portion) => portion.label && Number.isFinite(portion.multiplier) && portion.multiplier > 0).slice(0, 12);

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const validUuid = (value: string | null | undefined, label: string) => {
  if (!value || !uuidPattern.test(value)) throw new Error(`${label}无效`);
  return value;
};

const validDraftQuantity = (value: number) => {
  if (!Number.isFinite(value) || value <= 0 || value > 100) throw new Error("份数需要大于 0 且不超过 100");
  return Number(value);
};

const validDraftNote = (value: string | null | undefined) => value?.trim().slice(0, 200) || null;

export async function saveDietDayDraft(input: {
  recordDate: string;
  entries: DietEntry[];
  deletedIds: string[];
}): Promise<DietActionResult> {
  try {
    if (!isRecordDate(input.recordDate)) throw new Error("记录日期无效");
    if (input.entries.length > 200 || input.deletedIds.length > 200) throw new Error("单次保存的记录过多");
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };

    const entryIds = input.entries.map((entry) => validUuid(entry.id, "记录 ID"));
    const deletedIds = [...new Set(input.deletedIds.map((id) => validUuid(id, "删除记录 ID")))];
    if (new Set(entryIds).size !== entryIds.length) throw new Error("存在重复的饮食记录");
    if (entryIds.some((id) => deletedIds.includes(id))) throw new Error("同一条记录不能同时保存和删除");

    const { data: existingData, error: existingError } = await auth.supabase
      .from("diet_entries")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("record_date", input.recordDate);
    if (existingError) throw new Error(existingError.message);
    const existingById = new Map(((existingData ?? []) as DietEntry[]).map((entry) => [entry.id, entry]));
    const newEntries = input.entries.filter((entry) => !existingById.has(entry.id));

    const foodIds = [...new Set(newEntries.map((entry) => entry.food_id).filter((id): id is string => Boolean(id)).map((id) => validUuid(id, "食物 ID")))];
    const templateIds = [...new Set(newEntries
      .filter((entry) => entry.source_kind === "combination" || entry.source_kind === "menu")
      .map((entry) => entry.source_id)
      .filter((id): id is string => Boolean(id))
      .map((id) => validUuid(id, "模板 ID")))];

    const [foodResult, templateResult, templateItemResult] = await Promise.all([
      foodIds.length
        ? auth.supabase.from("food_items").select("*").eq("user_id", auth.user.id).in("id", foodIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length
        ? auth.supabase.from("diet_templates").select("id,kind,archived").eq("user_id", auth.user.id).in("id", templateIds)
        : Promise.resolve({ data: [], error: null }),
      templateIds.length
        ? auth.supabase.from("diet_template_items").select("template_id,food_id").in("template_id", templateIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const lookupError = foodResult.error ?? templateResult.error ?? templateItemResult.error;
    if (lookupError) throw new Error(lookupError.message);

    const foodById = new Map(((foodResult.data ?? []) as FoodItem[]).map((food) => [food.id, food]));
    const templateById = new Map(((templateResult.data ?? []) as { id: string; kind: DietTemplateKind; archived: boolean }[]).map((template) => [template.id, template]));
    const templateMembership = new Set(((templateItemResult.data ?? []) as { template_id: string; food_id: string }[])
      .map((item) => `${item.template_id}:${item.food_id}`));

    const rows = input.entries.map((entry) => {
      if (!(["breakfast", "lunch", "dinner", "snack"] as string[]).includes(entry.meal_slot)) throw new Error("餐次无效");
      if (!(["planned", "consumed"] as string[]).includes(entry.status)) throw new Error("记录状态无效");
      const quantity = validDraftQuantity(entry.quantity);
      const note = validDraftNote(entry.note);
      const existing = existingById.get(entry.id);
      if (existing) {
        return {
          ...existing,
          user_id: auth.user.id,
          record_date: input.recordDate,
          meal_slot: entry.meal_slot,
          status: entry.status,
          quantity,
          note,
        };
      }

      const groupId = validUuid(entry.group_id, "记录分组 ID");
      if (entry.estimated) {
        if (entry.source_kind !== "meal_estimate" || entry.food_id !== null || entry.source_id !== null) throw new Error("外食估算结构无效");
        const name = entry.name_snapshot.trim().slice(0, 120);
        const calories = finite(entry.calories_kcal_snapshot, "外食估算热量", true)!;
        if (!name || calories <= 0 || calories > 10000) throw new Error("外食估算内容无效");
        return {
          id: entry.id,
          user_id: auth.user.id,
          record_date: input.recordDate,
          meal_slot: entry.meal_slot,
          status: entry.status,
          source_kind: "meal_estimate",
          source_id: null,
          group_id: groupId,
          food_id: null,
          name_snapshot: name,
          standard_amount_snapshot: 1,
          standard_unit_snapshot: "餐",
          portion_options_snapshot: [],
          quantity,
          calories_kcal_snapshot: calories,
          protein_g_snapshot: null,
          carbs_g_snapshot: null,
          fat_g_snapshot: null,
          fiber_g_snapshot: null,
          caffeine_mg_snapshot: null,
          estimated: true,
          note,
        };
      }

      const foodId = validUuid(entry.food_id, "食物 ID");
      const food = foodById.get(foodId);
      if (!food || food.archived) throw new Error("食物已不存在或已归档，请刷新后重试");
      const sourceId = validUuid(entry.source_id, "来源 ID");
      if (entry.source_kind === "food") {
        if (sourceId !== foodId) throw new Error("食物来源无效");
      } else if (entry.source_kind === "combination" || entry.source_kind === "menu") {
        const template = templateById.get(sourceId);
        if (!template || template.archived || template.kind !== entry.source_kind || !templateMembership.has(`${sourceId}:${foodId}`)) {
          throw new Error("组合或菜单已发生变化，请刷新后重试");
        }
      } else {
        throw new Error("记录来源无效");
      }

      return {
        id: entry.id,
        user_id: auth.user.id,
        record_date: input.recordDate,
        meal_slot: entry.meal_slot,
        status: entry.status,
        source_kind: entry.source_kind,
        source_id: sourceId,
        group_id: groupId,
        food_id: foodId,
        name_snapshot: food.name,
        standard_amount_snapshot: food.standard_amount,
        standard_unit_snapshot: food.standard_unit,
        portion_options_snapshot: food.common_portions ?? [],
        quantity,
        calories_kcal_snapshot: food.calories_kcal,
        protein_g_snapshot: food.protein_g,
        carbs_g_snapshot: food.carbs_g,
        fat_g_snapshot: food.fat_g,
        fiber_g_snapshot: food.fiber_g,
        caffeine_mg_snapshot: food.caffeine_mg,
        estimated: false,
        note,
      };
    });

    if (rows.length > 0) {
      const { error } = await auth.supabase.from("diet_entries").upsert(rows, { onConflict: "id", defaultToNull: false });
      if (error) throw new Error(error.message);
    }
    if (deletedIds.length > 0) {
      const { error } = await auth.supabase.from("diet_entries")
        .delete()
        .eq("user_id", auth.user.id)
        .eq("record_date", input.recordDate)
        .in("id", deletedIds);
      if (error) throw new Error(error.message);
    }

    refreshDiet(input.recordDate);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveFood(input: {
  id?: string;
  name: string;
  standardAmount: number;
  standardUnit: string;
  caloriesKcal: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  fiberG?: number | null;
  caffeineMg?: number | null;
  tags: string[];
  commonPortions: FoodPortion[];
}): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据，请先登录 Supabase" };
    const name = input.name.trim();
    const standardUnit = input.standardUnit.trim();
    if (!name || name.length > 80) throw new Error("食物名称需要填写且不超过 80 个字符");
    if (!standardUnit || standardUnit.length > 20) throw new Error("标准份量单位需要填写且不超过 20 个字符");
    if (!Number.isFinite(input.standardAmount) || input.standardAmount <= 0) throw new Error("标准份量需要大于 0");

    const payload = {
      user_id: auth.user.id,
      name,
      standard_amount: input.standardAmount,
      standard_unit: standardUnit,
      calories_kcal: finite(input.caloriesKcal, "热量", true),
      protein_g: finite(input.proteinG, "蛋白质"),
      carbs_g: finite(input.carbsG, "碳水"),
      fat_g: finite(input.fatG, "脂肪"),
      fiber_g: finite(input.fiberG, "膳食纤维"),
      caffeine_mg: finite(input.caffeineMg, "咖啡因"),
      tags: cleanTags(input.tags),
      common_portions: cleanPortions(input.commonPortions),
    };
    const query = input.id
      ? auth.supabase.from("food_items").update(payload).eq("id", input.id).eq("user_id", auth.user.id)
      : auth.supabase.from("food_items").insert(payload);
    const { data, error } = await query.select("id").single();
    if (error) throw new Error(error.message);
    refreshDiet();
    return { ok: true, id: data.id };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleFoodArchive(id: string, archived: boolean): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const { error } = await auth.supabase.from("food_items").update({ archived }).eq("id", id).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
    refreshDiet();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveNutritionTargets(input: NutritionTargets): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const payload = {
      user_id: auth.user.id,
      calories_kcal: finite(input.calories_kcal, "热量目标"),
      protein_g: finite(input.protein_g, "蛋白质目标"),
      carbs_g: finite(input.carbs_g, "碳水目标"),
      fat_g: finite(input.fat_g, "脂肪目标"),
      fiber_g: finite(input.fiber_g, "膳食纤维目标"),
      caffeine_mg: finite(input.caffeine_mg, "咖啡因上限"),
      resting_metabolism_kcal: finite(input.resting_metabolism_kcal, "基础代谢", true),
      calorie_deficit_kcal: finite(input.calorie_deficit_kcal, "热量缺口", true),
    };
    const { error } = await auth.supabase.from("nutrition_targets").upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    refreshDiet();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addDietResource(input: {
  recordDate: string;
  mealSlot: MealSlot;
  resourceKind: "food" | DietTemplateKind;
  resourceId: string;
  status?: DietEntryStatus;
}): Promise<DietActionResult> {
  try {
    if (!isRecordDate(input.recordDate)) throw new Error("记录日期无效");
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    let status = input.status;
    if (!status) {
      const { data: profile } = await auth.supabase.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle();
      status = defaultDietStatus(input.recordDate, todayInTimeZone(profile?.timezone ?? "Australia/Sydney"));
    }
    const { error } = await auth.supabase.rpc("add_diet_resource", {
      p_record_date: input.recordDate,
      p_meal_slot: input.mealSlot,
      p_resource_kind: input.resourceKind,
      p_resource_id: input.resourceId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    refreshDiet(input.recordDate);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function addDiningEstimate(input: {
  recordDate: string;
  mealSlot: MealSlot;
  caloriesKcal: number;
  label: string;
  note?: string;
  status?: DietEntryStatus;
}): Promise<DietActionResult> {
  try {
    if (!isRecordDate(input.recordDate)) throw new Error("记录日期无效");
    if (!Number.isFinite(input.caloriesKcal) || input.caloriesKcal <= 0 || input.caloriesKcal > 10000) {
      throw new Error("外食估算热量需要在 1–10000 kcal 之间");
    }
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    let status = input.status;
    if (!status) {
      const { data: profile } = await auth.supabase.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle();
      status = defaultDietStatus(input.recordDate, todayInTimeZone(profile?.timezone ?? "Australia/Sydney"));
    }
    const { data, error } = await auth.supabase.from("diet_entries").insert({
      user_id: auth.user.id,
      record_date: input.recordDate,
      meal_slot: input.mealSlot,
      status,
      source_kind: "meal_estimate",
      source_id: null,
      food_id: null,
      name_snapshot: `外食估算 · ${input.label.trim() || "自定义"}`,
      standard_amount_snapshot: 1,
      standard_unit_snapshot: "餐",
      portion_options_snapshot: [],
      quantity: 1,
      calories_kcal_snapshot: input.caloriesKcal,
      protein_g_snapshot: null,
      carbs_g_snapshot: null,
      fat_g_snapshot: null,
      fiber_g_snapshot: null,
      caffeine_mg_snapshot: null,
      estimated: true,
      note: input.note?.trim().slice(0, 200) || null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    refreshDiet(input.recordDate);
    return { ok: true, id: data.id };
  } catch (error) {
    return fail(error);
  }
}

export async function updateDietEntry(input: {
  id: string;
  recordDate: string;
  quantity?: number;
  status?: DietEntryStatus;
  mealSlot?: MealSlot;
  note?: string | null;
}): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const payload: Record<string, string | number | null> = {};
    if (input.quantity !== undefined) {
      if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > 100) throw new Error("份数需要大于 0 且不超过 100");
      payload.quantity = input.quantity;
    }
    if (input.status) payload.status = input.status;
    if (input.mealSlot) payload.meal_slot = input.mealSlot;
    if (input.note !== undefined) payload.note = input.note?.trim().slice(0, 200) || null;
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await auth.supabase.from("diet_entries").update(payload).eq("id", input.id).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
    refreshDiet(input.recordDate);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDietEntry(id: string, recordDate: string): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const { error } = await auth.supabase.from("diet_entries").delete().eq("id", id).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
    refreshDiet(recordDate);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveDietTemplate(input: {
  name: string;
  kind: DietTemplateKind;
  tags: string[];
  entryIds: string[];
  templateId?: string;
}): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const entryIds = [...new Set(input.entryIds)];
    if (input.kind === "combination" && entryIds.length < 2) throw new Error("组合至少需要 2 项食物");
    if (input.kind === "menu" && entryIds.length < 1) throw new Error("菜单至少需要 1 项食物");

    const { data: sourceEntries, error: sourceError } = await auth.supabase
      .from("diet_entries")
      .select("id,meal_slot,food_id")
      .eq("user_id", auth.user.id)
      .in("id", entryIds);
    if (sourceError) throw new Error(sourceError.message);
    if (!sourceEntries || sourceEntries.length !== entryIds.length) throw new Error("部分餐次记录不存在或无权访问");
    if (sourceEntries.some((entry) => !entry.food_id)) throw new Error("外食估算不能保存到组合或菜单");
    if (new Set(sourceEntries.map((entry) => entry.meal_slot)).size !== 1) throw new Error("组合和菜单必须来自同一个餐次");

    const { data, error } = await auth.supabase.rpc("save_diet_template_from_entries", {
      p_name: input.name.trim(),
      p_kind: input.kind,
      p_tags: cleanTags(input.tags),
      p_entry_ids: entryIds,
      p_template_id: input.templateId ?? null,
    });
    if (error) throw new Error(error.message);
    refreshDiet();
    return { ok: true, id: data as string };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleDietTemplateArchive(id: string, archived: boolean): Promise<DietActionResult> {
  try {
    const auth = await dietAuth();
    if (!auth) return { ok: false, error: "演示模式不能修改数据" };
    const { error } = await auth.supabase.from("diet_templates").update({ archived }).eq("id", id).eq("user_id", auth.user.id);
    if (error) throw new Error(error.message);
    refreshDiet();
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
