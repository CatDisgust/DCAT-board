import { describe, expect, it } from "vitest";
import { analyzeDietHistory, calculateDailyCalorieTarget, defaultDietStatus, suggestMacrosFromWeight, suggestNutritionTargets, summarizeDietEntries } from "./diet";
import type { DietEntry, NutritionTargets } from "./types";

const entry = (overrides: Partial<DietEntry> = {}): DietEntry => ({
  id: crypto.randomUUID(), record_date: "2026-08-05", meal_slot: "lunch", status: "consumed",
  source_kind: "food", source_id: null, group_id: crypto.randomUUID(), food_id: crypto.randomUUID(),
  name_snapshot: "测试食物", standard_amount_snapshot: 100, standard_unit_snapshot: "g",
  portion_options_snapshot: [], quantity: 1, calories_kcal_snapshot: 200, protein_g_snapshot: 20,
  carbs_g_snapshot: 10, fat_g_snapshot: 8, fiber_g_snapshot: 4, caffeine_mg_snapshot: 0,
  estimated: false, note: null, ...overrides,
});

const targets: NutritionTargets = {
  calories_kcal: 2000, protein_g: 100, carbs_g: null, fat_g: null, fiber_g: 25, caffeine_mg: null,
  resting_metabolism_kcal: 1600, calorie_deficit_kcal: 300,
};

describe("diet summaries", () => {
  it("only includes consumed entries in actual totals", () => {
    const summary = summarizeDietEntries([entry(), entry({ status: "planned", quantity: 2 })]);
    expect(summary.values.calories_kcal).toBe(200);
    expect(summarizeDietEntries([entry(), entry({ status: "planned", quantity: 2 })], true).values.calories_kcal).toBe(600);
  });

  it("keeps unknown nutrients partial instead of treating them as known zero", () => {
    const summary = summarizeDietEntries([entry({ protein_g_snapshot: null, calories_kcal_snapshot: 1000, estimated: true })]);
    expect(summary.values.protein_g).toBe(0);
    expect(summary.partial.protein_g).toBe(true);
    expect(summary.estimatedCalories).toBe(1000);
  });

  it("averages recorded days only and reports estimate ratio", () => {
    const analysis = analyzeDietHistory([
      entry({ record_date: "2026-08-04", calories_kcal_snapshot: 1000, estimated: true }),
      entry({ record_date: "2026-08-05", calories_kcal_snapshot: 500 }),
    ], targets, "2026-08-05");
    expect(analysis.average7).toBe(750);
    expect(analysis.average7Sample).toBe(2);
    expect(analysis.estimatedCalorieRatio).toBe(67);
  });

  it("defaults future entries to planned and today or past to consumed", () => {
    expect(defaultDietStatus("2026-08-07", "2026-08-06")).toBe("planned");
    expect(defaultDietStatus("2026-08-06", "2026-08-06")).toBe("consumed");
    expect(defaultDietStatus("2026-08-05", "2026-08-06")).toBe("consumed");
  });

  it("generates reviewable weight-based nutrition presets", () => {
    expect(suggestNutritionTargets(80, "maintain")).toEqual({
      calories_kcal: 2400,
      protein_g: 128,
      carbs_g: 328,
      fat_g: 64,
      fiber_g: 25,
      caffeine_mg: null,
      resting_metabolism_kcal: 1600,
      calorie_deficit_kcal: 0,
    });
    expect(suggestNutritionTargets(80, "cut").calories_kcal).toBe(2000);
    expect(suggestNutritionTargets(80, "gain").calories_kcal).toBe(2640);
  });

  it("derives the daily calorie target from resting, active and deficit energy", () => {
    expect(calculateDailyCalorieTarget(1600, 520, 300)).toBe(1820);
    expect(calculateDailyCalorieTarget(1600, null, 300)).toBeNull();
  });

  it("uses weight and a dynamic calorie target for macro starting points", () => {
    expect(suggestMacrosFromWeight(80, 2000)).toEqual({ protein_g: 144, carbs_g: 212, fat_g: 64, fiber_g: 25 });
  });
});
