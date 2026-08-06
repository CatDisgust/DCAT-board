import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import type {
  DietEntry,
  DietNutrientKey,
  DietNutrientPartial,
  DietNutrientValues,
  MealSlot,
  NutritionTargets,
} from "./types";

export const mealSlots: Array<{ value: MealSlot; label: string }> = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
];

export const foodCategoryLabels: Record<string, string> = {
  protein: "蛋白质",
  vegetables: "蔬菜与膳食纤维",
  carbs: "碳水",
  drinks: "饮品",
  other: "其他",
};

export const nutrientMeta: Record<DietNutrientKey, { label: string; unit: string }> = {
  calories_kcal: { label: "热量", unit: "kcal" },
  protein_g: { label: "蛋白质", unit: "g" },
  carbs_g: { label: "碳水", unit: "g" },
  fat_g: { label: "脂肪", unit: "g" },
  fiber_g: { label: "膳食纤维", unit: "g" },
  caffeine_mg: { label: "咖啡因", unit: "mg" },
};

export const nutrientKeys = Object.keys(nutrientMeta) as DietNutrientKey[];
export const coreNutrientKeys = nutrientKeys.filter((key) => key !== "caffeine_mg");
export const macroTargetKeys: DietNutrientKey[] = ["protein_g", "carbs_g", "fat_g", "fiber_g"];

export type NutritionGoalMode = "cut" | "maintain" | "gain";

export function suggestNutritionTargets(weightKg: number, mode: NutritionGoalMode): NutritionTargets {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("需要有效体重才能生成营养目标");
  }
  const presets: Record<NutritionGoalMode, { caloriesPerKg: number; proteinPerKg: number }> = {
    cut: { caloriesPerKg: 25, proteinPerKg: 1.8 },
    maintain: { caloriesPerKg: 30, proteinPerKg: 1.6 },
    gain: { caloriesPerKg: 33, proteinPerKg: 1.8 },
  };
  const preset = presets[mode];
  const calories = Math.round(weightKg * preset.caloriesPerKg / 10) * 10;
  const protein = Math.round(weightKg * preset.proteinPerKg);
  const fat = Math.round(weightKg * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories_kcal: calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fiber_g: 25,
    caffeine_mg: null,
    resting_metabolism_kcal: 1600,
    calorie_deficit_kcal: mode === "cut" ? 300 : 0,
  };
}

export function calculateDailyCalorieTarget(restingMetabolismKcal: number, activeEnergyKcal: number | null, calorieDeficitKcal: number) {
  if (activeEnergyKcal === null) return null;
  if (!Number.isFinite(restingMetabolismKcal) || restingMetabolismKcal <= 0) return null;
  if (!Number.isFinite(activeEnergyKcal) || activeEnergyKcal < 0) return null;
  if (!Number.isFinite(calorieDeficitKcal) || calorieDeficitKcal < 0) return null;
  return Math.max(0, Math.round(restingMetabolismKcal + activeEnergyKcal - calorieDeficitKcal));
}

export function suggestMacrosFromWeight(weightKg: number, calorieTarget: number) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error("需要有效体重才能生成宏量目标");
  const protein_g = Math.round(weightKg * 1.8);
  const fat_g = Math.round(weightKg * 0.8);
  const carbs_g = Math.max(0, Math.round((calorieTarget - protein_g * 4 - fat_g * 9) / 4));
  return { protein_g, carbs_g, fat_g, fiber_g: 25 };
}

const snapshotKey: Record<DietNutrientKey, keyof DietEntry> = {
  calories_kcal: "calories_kcal_snapshot",
  protein_g: "protein_g_snapshot",
  carbs_g: "carbs_g_snapshot",
  fat_g: "fat_g_snapshot",
  fiber_g: "fiber_g_snapshot",
  caffeine_mg: "caffeine_mg_snapshot",
};

const emptyValues = (): DietNutrientValues => ({
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  caffeine_mg: 0,
});

const emptyPartial = (): DietNutrientPartial => ({
  calories_kcal: false,
  protein_g: false,
  carbs_g: false,
  fat_g: false,
  fiber_g: false,
  caffeine_mg: false,
});

export function summarizeDietEntries(entries: DietEntry[], includePlanned = false) {
  const selected = entries.filter((entry) => includePlanned || entry.status === "consumed");
  const values = emptyValues();
  const partial = emptyPartial();
  let estimatedCalories = 0;

  for (const entry of selected) {
    for (const key of nutrientKeys) {
      const raw = entry[snapshotKey[key]] as number | null;
      if (raw === null) partial[key] = true;
      else values[key] += raw * entry.quantity;
    }
    if (entry.estimated) estimatedCalories += entry.calories_kcal_snapshot * entry.quantity;
  }

  for (const key of nutrientKeys) values[key] = Number(values[key].toFixed(1));
  return {
    values,
    partial,
    hasEntries: selected.length > 0,
    entryCount: selected.length,
    estimatedCalories: Number(estimatedCalories.toFixed(1)),
    hasEstimate: selected.some((entry) => entry.estimated),
    mealCount: new Set(selected.map((entry) => entry.meal_slot)).size,
  };
}

export function defaultDietStatus(date: string, today: string) {
  return date > today ? "planned" as const : "consumed" as const;
}

export function analyzeDietHistory(entries: DietEntry[], targets: NutritionTargets, endDate?: string) {
  const consumed = entries.filter((entry) => entry.status === "consumed");
  const lastDate = endDate ?? consumed.map((entry) => entry.record_date).sort().at(-1) ?? format(new Date(), "yyyy-MM-dd");
  const end = parseISO(lastDate);
  const dates = eachDayOfInterval({ start: subDays(end, 29), end }).map((date) => format(date, "yyyy-MM-dd"));
  const daily = dates.map((date) => {
    const dayEntries = consumed.filter((entry) => entry.record_date === date);
    const summary = summarizeDietEntries(dayEntries);
    return { date, ...summary };
  });
  const recorded = daily.filter((day) => day.hasEntries);
  const recent7 = daily.slice(-7).filter((day) => day.hasEntries);
  const averageCalories = (days: typeof daily) => days.length
    ? Number((days.reduce((sum, day) => sum + day.values.calories_kcal, 0) / days.length).toFixed(0))
    : null;
  const estimatedCalories = recorded.reduce((sum, day) => sum + day.estimatedCalories, 0);
  const totalCalories = recorded.reduce((sum, day) => sum + day.values.calories_kcal, 0);
  const completeDays = recorded.filter((day) => coreNutrientKeys.every((key) => !day.partial[key])).length;
  const targetDays = coreNutrientKeys.reduce((result, key) => {
    const target = targets[key];
    if (target === null) return result;
    result[key] = recorded.filter((day) => {
      if (day.partial[key]) return false;
      const value = day.values[key];
      return key === "protein_g" || key === "fiber_g" ? value >= target : value <= target;
    }).length;
    return result;
  }, {} as Partial<Record<DietNutrientKey, number>>);

  return {
    daily,
    average7: averageCalories(recent7),
    average7Sample: recent7.length,
    average30: averageCalories(recorded),
    average30Sample: recorded.length,
    recordedDays: recorded.length,
    completeDays,
    estimatedMealCount: consumed.filter((entry) => entry.estimated).length,
    estimatedCalorieRatio: totalCalories > 0 ? Number((estimatedCalories / totalCalories * 100).toFixed(0)) : null,
    targetDays,
  };
}
