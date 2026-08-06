import { format, parseISO, subDays } from "date-fns";
import { dateInTimeZone } from "./user-date";
import type { DietEntry, DietTemplate, FoodItem, NutritionTargets } from "./types";

const today = parseISO(dateInTimeZone(new Date(), "Australia/Sydney"));

export const demoFoods: FoodItem[] = [
  {
    id: "10000000-0000-4000-8000-000000000001", name: "水煮蛋", standard_amount: 1, standard_unit: "个",
    calories_kcal: 78, protein_g: 6.3, carbs_g: 0.6, fat_g: 5.3, fiber_g: 0, caffeine_mg: 0,
    tags: ["protein", "早餐"], common_portions: [{ label: "2 个", multiplier: 2 }, { label: "3 个", multiplier: 3 }], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000002", name: "烤鸡腿肉", standard_amount: 150, standard_unit: "g",
    calories_kcal: 285, protein_g: 37, carbs_g: 0, fat_g: 14, fiber_g: 0, caffeine_mg: 0,
    tags: ["protein", "常用"], common_portions: [{ label: "200 g", multiplier: 1.333 }], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000003", name: "煎牛排", standard_amount: 180, standard_unit: "g",
    calories_kcal: 410, protein_g: 48, carbs_g: 0, fat_g: 24, fiber_g: 0, caffeine_mg: 0,
    tags: ["protein", "晚餐"], common_portions: [{ label: "半份", multiplier: 0.5 }], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000004", name: "清炒卷心菜", standard_amount: 200, standard_unit: "g",
    calories_kcal: 132, protein_g: 4, carbs_g: 18, fat_g: 6, fiber_g: 7, caffeine_mg: 0,
    tags: ["vegetables", "晚餐"], common_portions: [], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000005", name: "藜麦糙米饭", standard_amount: 180, standard_unit: "g",
    calories_kcal: 245, protein_g: 6, carbs_g: 49, fat_g: 3, fiber_g: 5, caffeine_mg: 0,
    tags: ["carbs", "主食"], common_portions: [{ label: "半碗", multiplier: 0.5 }, { label: "一碗半", multiplier: 1.5 }], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000006", name: "美式咖啡", standard_amount: 1, standard_unit: "杯",
    calories_kcal: 5, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, caffeine_mg: 120,
    tags: ["drinks", "咖啡因"], common_portions: [{ label: "大杯", multiplier: 1.5 }], archived: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000007", name: "无糖绿茶", standard_amount: 1, standard_unit: "杯",
    calories_kcal: 0, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, caffeine_mg: 35,
    tags: ["drinks", "饮品"], common_portions: [], archived: false,
  },
];

export const demoDietTemplates: DietTemplate[] = [
  {
    id: "20000000-0000-4000-8000-000000000001", kind: "combination", name: "鸡腿糙米组合", tags: ["午餐", "高蛋白"], archived: false,
    items: [
      { template_id: "20000000-0000-4000-8000-000000000001", food_id: demoFoods[1].id, portion_multiplier: 1, food: demoFoods[1] },
      { template_id: "20000000-0000-4000-8000-000000000001", food_id: demoFoods[4].id, portion_multiplier: 1, food: demoFoods[4] },
    ],
  },
  {
    id: "20000000-0000-4000-8000-000000000002", kind: "menu", name: "牛排晚餐", tags: ["晚餐"], archived: false,
    items: [
      { template_id: "20000000-0000-4000-8000-000000000002", food_id: demoFoods[2].id, portion_multiplier: 1, food: demoFoods[2] },
      { template_id: "20000000-0000-4000-8000-000000000002", food_id: demoFoods[3].id, portion_multiplier: 1, food: demoFoods[3] },
      { template_id: "20000000-0000-4000-8000-000000000002", food_id: demoFoods[4].id, portion_multiplier: 0.5, food: demoFoods[4] },
    ],
  },
];

const entryFromFood = (
  food: FoodItem,
  recordDate: string,
  mealSlot: DietEntry["meal_slot"],
  quantity: number,
  index: number,
  status: DietEntry["status"] = "consumed",
): DietEntry => ({
  id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  record_date: recordDate,
  meal_slot: mealSlot,
  status,
  source_kind: "food",
  source_id: food.id,
  group_id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  food_id: food.id,
  name_snapshot: food.name,
  standard_amount_snapshot: food.standard_amount,
  standard_unit_snapshot: food.standard_unit,
  portion_options_snapshot: food.common_portions,
  quantity,
  calories_kcal_snapshot: food.calories_kcal,
  protein_g_snapshot: food.protein_g,
  carbs_g_snapshot: food.carbs_g,
  fat_g_snapshot: food.fat_g,
  fiber_g_snapshot: food.fiber_g,
  caffeine_mg_snapshot: food.caffeine_mg,
  estimated: false,
  note: null,
});

export const demoDietEntries: DietEntry[] = Array.from({ length: 10 }, (_, offset) => {
  const date = format(subDays(today, 9 - offset), "yyyy-MM-dd");
  const base = offset * 6;
  const entries = [
    entryFromFood(demoFoods[0], date, "breakfast", offset % 3 === 0 ? 3 : 2, base + 1),
    entryFromFood(demoFoods[5], date, "breakfast", 1, base + 2),
    entryFromFood(demoFoods[1], date, "lunch", 1, base + 3),
    entryFromFood(demoFoods[4], date, "lunch", offset % 4 === 0 ? 1.5 : 1, base + 4),
    entryFromFood(demoFoods[2], date, "dinner", 1, base + 5),
    entryFromFood(demoFoods[3], date, "dinner", 1, base + 6),
  ];
  if (offset === 9) entries[4].status = "planned";
  return entries;
}).flat();

export const demoNutritionTargets: NutritionTargets = {
  calories_kcal: 2100,
  protein_g: 130,
  carbs_g: 220,
  fat_g: 70,
  fiber_g: 28,
  caffeine_mg: null,
  resting_metabolism_kcal: 1600,
  calorie_deficit_kcal: 300,
};
