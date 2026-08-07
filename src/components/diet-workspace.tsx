"use client";

import { useEffect, useMemo, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronRight,
  CircleAlert,
  Coffee,
  GripVertical,
  Library,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  saveDietTemplate,
  saveDietDayDraft,
  saveFood,
  saveNutritionTargets,
  toggleDietTemplateArchive,
  toggleFoodArchive,
  type DietActionResult,
} from "@/app/diet/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateDailyCalorieTarget, coreNutrientKeys, defaultDietStatus, foodCategoryLabels, macroTargetKeys, mealSlots, nutrientMeta, suggestMacrosFromWeight, summarizeDietEntries } from "@/lib/diet";
import type {
  DietEntry,
  DietEntryStatus,
  DietNutrientKey,
  DietTemplate,
  DietTemplateKind,
  FoodItem,
  MealSlot,
  NutritionTargets,
} from "@/lib/types";

type ResourceTab = "food" | DietTemplateKind;
type ResourcePayload = { kind: ResourceTab; id: string };
type TemplateDraft = { kind: DietTemplateKind; entryIds: string[]; sourceLabel: string };

const nullableFormNumber = (form: FormData, key: string) => {
  const value = form.get(key)?.toString().trim();
  return value ? Number(value) : null;
};

const formatValue = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

const templateNutrition = (template: DietTemplate) => template.items.reduce((sum, item) => {
  if (!item.food) return sum;
  sum.calories += item.food.calories_kcal * item.portion_multiplier;
  sum.protein += (item.food.protein_g ?? 0) * item.portion_multiplier;
  return sum;
}, { calories: 0, protein: 0 });

const draftEntryFromFood = ({
  food,
  recordDate,
  mealSlot,
  status,
  sourceKind,
  sourceId,
  groupId,
  quantity = 1,
}: {
  food: FoodItem;
  recordDate: string;
  mealSlot: MealSlot;
  status: DietEntryStatus;
  sourceKind: "food" | DietTemplateKind;
  sourceId: string;
  groupId: string;
  quantity?: number;
}): DietEntry => ({
  id: crypto.randomUUID(),
  record_date: recordDate,
  meal_slot: mealSlot,
  status,
  source_kind: sourceKind,
  source_id: sourceId,
  group_id: groupId,
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
  created_at: new Date().toISOString(),
});

const mutableEntryChanged = (next: DietEntry, saved: DietEntry) => (
  next.meal_slot !== saved.meal_slot
  || next.status !== saved.status
  || next.quantity !== saved.quantity
  || next.note !== saved.note
);

export function DietWorkspace({
  foods,
  templates,
  entries: initialEntries,
  targets,
  currentWeight,
  currentWeightDate,
  activeEnergyKcal,
  date,
  today,
  demo,
}: {
  foods: FoodItem[];
  templates: DietTemplate[];
  entries: DietEntry[];
  targets: NutritionTargets;
  currentWeight: number | null;
  currentWeightDate: string | null;
  activeEnergyKcal: number | null;
  date: string;
  today: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState(initialEntries);
  const [savedEntries, setSavedEntries] = useState(initialEntries);
  const [tab, setTab] = useState<ResourceTab>("food");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [foodEditor, setFoodEditor] = useState<FoodItem | "new" | null>(null);
  const [mealPicker, setMealPicker] = useState<{ payload: ResourcePayload; name: string } | null>(null);
  const [estimateSlot, setEstimateSlot] = useState<MealSlot | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [targetEditor, setTargetEditor] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DietEntry | null>(null);

  const changes = useMemo(() => {
    const savedById = new Map(savedEntries.map((entry) => [entry.id, entry]));
    const currentIds = new Set(entries.map((entry) => entry.id));
    const upserts = entries.filter((entry) => {
      const saved = savedById.get(entry.id);
      return !saved || mutableEntryChanged(entry, saved);
    });
    const deletedIds = savedEntries.filter((entry) => !currentIds.has(entry.id)).map((entry) => entry.id);
    return { upserts, deletedIds, count: upserts.length + deletedIds.length };
  }, [entries, savedEntries]);

  useEffect(() => {
    if (changes.count === 0) return;
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [changes.count]);

  const run = (task: () => Promise<DietActionResult>, success?: string) => {
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setNotice({ type: "error", text: result.error });
        return;
      }
      if (success) setNotice({ type: "success", text: success });
      router.refresh();
    });
  };

  const saveDay = () => {
    if (changes.count === 0) return;
    setNotice(null);
    startTransition(async () => {
      const result = await saveDietDayDraft({ recordDate: date, entries: changes.upserts, deletedIds: changes.deletedIds });
      if (!result.ok) {
        setNotice({ type: "error", text: result.error });
        return;
      }
      setSavedEntries(entries);
      setPendingDelete(null);
      setNotice({ type: "success", text: "今日饮食已一次保存" });
      router.refresh();
    });
  };

  const discardDayChanges = () => {
    setEntries(savedEntries);
    setPendingDelete(null);
    setSelected(new Set());
    setNotice({ type: "success", text: "已放弃未保存的修改" });
  };

  const activeResources = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (tab === "food") return foods.filter((food) => {
      if (!showArchived && food.archived) return false;
      if (category !== "all" && !food.tags.includes(category)) return false;
      return !query || `${food.name} ${food.tags.join(" ")}`.toLowerCase().includes(query);
    });
    return templates.filter((template) => template.kind === tab)
      .filter((template) => showArchived || !template.archived)
      .filter((template) => !query || `${template.name} ${template.tags.join(" ")}`.toLowerCase().includes(query));
  }, [category, foods, search, showArchived, tab, templates]);

  const addResource = (payload: ResourcePayload, mealSlot: MealSlot) => {
    const status = defaultDietStatus(date, today);
    const groupId = crypto.randomUUID();
    if (payload.kind === "food") {
      const food = foods.find((item) => item.id === payload.id && !item.archived);
      if (!food) {
        setNotice({ type: "error", text: "食物已不存在或已归档" });
        return;
      }
      setEntries((current) => [...current, draftEntryFromFood({ food, recordDate: date, mealSlot, status, sourceKind: "food", sourceId: food.id, groupId })]);
    } else {
      const template = templates.find((item) => item.id === payload.id && item.kind === payload.kind && !item.archived);
      const draftEntries = template?.items.flatMap((item) => item.food
        ? [draftEntryFromFood({ food: item.food, recordDate: date, mealSlot, status, sourceKind: template.kind, sourceId: template.id, groupId, quantity: item.portion_multiplier })]
        : []) ?? [];
      if (!template || draftEntries.length === 0) {
        setNotice({ type: "error", text: "组合或菜单为空，请先检查资源内容" });
        return;
      }
      setEntries((current) => [...current, ...draftEntries]);
    }
    setNotice({ type: "success", text: "已加入本地草稿，点击“保存今日记录”后写入" });
  };

  const updateQuantity = (entry: DietEntry, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, quantity } : item));
    setNotice({ type: "success", text: "份量已更新到本地草稿" });
  };

  const requestDelete = (entry: DietEntry) => {
    setEntries((current) => current.filter((item) => item.id !== entry.id));
    setSelected((current) => new Set([...current].filter((id) => id !== entry.id)));
    setPendingDelete(entry);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    setEntries((current) => [...current, pendingDelete].sort((a, b) => (a.created_at ?? a.id).localeCompare(b.created_at ?? b.id)));
    setPendingDelete(null);
  };

  const toggleSelected = (id: string) => {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      const selectedMeal = [...current]
        .map((selectedId) => entries.find((item) => item.id === selectedId)?.meal_slot)
        .find(Boolean);
      if (selectedMeal && selectedMeal !== entry.meal_slot) {
        setNotice({ type: "success", text: "组合只能来自同一餐次，已切换到当前餐次。" });
        return new Set([id]);
      }
      next.add(id);
      return next;
    });
  };

  return (
    <>
      {demo && <div className="diet-banner"><CircleAlert /> 当前为演示数据。登录后即可建立你的封闭食物库并自动保存。</div>}
      {notice && <div className={`diet-notice ${notice.type}`} role="status">{notice.type === "success" ? <Check /> : <CircleAlert />}{notice.text}<button onClick={() => setNotice(null)} aria-label="关闭"><X /></button></div>}
      {pendingDelete && <div className="diet-undo" role="status"><span>已从本地草稿移除“{pendingDelete.name_snapshot}”，尚未写入数据库。</span><Button size="sm" variant="outline" onClick={undoDelete}><RotateCcw />撤销</Button></div>}

      <div className="diet-workspace" aria-busy={pending}>
        <NutritionPanel entries={entries} targets={targets} activeEnergyKcal={activeEnergyKcal} onEditTargets={() => setTargetEditor(true)} />

        <Card className="diet-library surface gap-0 py-0">
          <div className="diet-panel-title"><div><Library /><span><b>我的资源</b><small>拖拽或点击加入</small></span></div><Button size="icon-sm" onClick={() => setFoodEditor("new")} disabled={demo} aria-label="新增食物"><Plus /></Button></div>
          <div className="diet-tabs" role="tablist">
            {(["food", "combination", "menu"] as ResourceTab[]).map((value) => <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{value === "food" ? "食物" : value === "combination" ? "组合" : "菜单"}</button>)}
          </div>
          <label className="diet-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称或标签" /></label>
          {tab === "food" && <select className="diet-filter" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="食物类别">
            <option value="all">全部类别</option>
            {Object.entries(foodCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>}
          <label className="diet-archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />显示已归档</label>

          <div className="diet-resource-list">
            {activeResources.length === 0 && <div className="diet-empty">没有匹配的{tab === "food" ? "食物" : tab === "combination" ? "组合" : "菜单"}。</div>}
            {activeResources.map((resource) => {
              const archived = resource.archived;
              const isFood = tab === "food";
              const food = isFood ? resource as FoodItem : null;
              const template = !isFood ? resource as DietTemplate : null;
              const preview = template ? templateNutrition(template) : null;
              return <article
                className={`diet-resource ${archived ? "archived" : ""}`}
                key={resource.id}
                draggable={!archived && !demo}
                title={!archived && !demo ? "拖拽到右侧餐次，或点击选择餐次" : undefined}
                onDragStart={(event) => event.dataTransfer.setData("application/daymark-diet", JSON.stringify({ kind: tab, id: resource.id }))}
              >
                <button className="diet-resource-main" type="button" disabled={archived || demo} aria-label={`将${resource.name}加入餐次`} onClick={() => setMealPicker({ payload: { kind: tab, id: resource.id }, name: resource.name })}><GripVertical className="drag-handle" /><span><b>{resource.name}</b><small>{food ? `${food.standard_amount} ${food.standard_unit} · ${formatValue(food.calories_kcal)} kcal` : `${template?.items.length ?? 0} 项 · ${formatValue(preview?.calories ?? 0)} kcal`}</small></span></button>
                <div className="diet-tag-row">{resource.tags.slice(0, 2).map((tag) => <i key={tag}>{foodCategoryLabels[tag] ?? tag}</i>)}</div>
                <div className="diet-resource-actions">
                  {food && <button disabled={demo} onClick={(event) => { event.stopPropagation(); setFoodEditor(food); }}><Pencil />编辑</button>}
                  <button disabled={demo} onClick={(event) => {
                    event.stopPropagation();
                    run(() => food
                      ? toggleFoodArchive(food.id, !food.archived)
                      : toggleDietTemplateArchive(template!.id, !template!.archived));
                  }}><Archive />{archived ? "恢复" : "归档"}</button>
                </div>
              </article>;
            })}
          </div>
        </Card>

        <section className="diet-day-column">
          <div className="diet-day-toolbar">
            <div><b>{date === today ? "今天" : date}</b><span>{changes.count > 0 ? `${changes.count} 项修改保存在本页，尚未写入` : date > today ? "默认记为计划" : "所有记录已保存"}</span></div>
            <div className="diet-day-actions">
              <Button size="sm" variant="outline" disabled={selected.size < 2 || demo || changes.count > 0} title={changes.count > 0 ? "先保存今日记录，再创建组合" : undefined} onClick={() => setTemplateDraft({ kind: "combination", entryIds: [...selected], sourceLabel: "当前餐次中选中的食物" })}><Save />保存所选组合{selected.size > 0 ? ` (${selected.size})` : ""}</Button>
              {changes.count > 0 && <Button size="sm" variant="ghost" disabled={pending} onClick={discardDayChanges}>放弃修改</Button>}
              <Button size="sm" disabled={demo || pending || changes.count === 0} onClick={saveDay}><Save />{pending ? "正在保存…" : changes.count > 0 ? `保存今日记录 (${changes.count})` : "今日记录已保存"}</Button>
            </div>
          </div>
          {mealSlots.map((slot) => {
            const slotEntries = entries.filter((entry) => entry.meal_slot === slot.value);
            const slotSummary = summarizeDietEntries(slotEntries);
            return <MealCard
              key={slot.value}
              slot={slot.value}
              label={slot.label}
              entries={slotEntries}
              calories={slotSummary.values.calories_kcal}
              selected={selected}
              disabled={demo || pending}
              onDrop={(payload) => addResource(payload, slot.value)}
              onEstimate={() => setEstimateSlot(slot.value)}
              onSaveMenu={() => {
                if (changes.count > 0) {
                  setNotice({ type: "error", text: "请先保存今日记录，再把整餐保存为菜单" });
                  return;
                }
                const reusableEntries = slotEntries.filter((entry) => entry.food_id);
                if (reusableEntries.length === 0) return;
                setTemplateDraft({ kind: "menu", entryIds: reusableEntries.map((entry) => entry.id), sourceLabel: `${slot.label}的全部可复用食物` });
              }}
              onSelect={toggleSelected}
              onQuantity={updateQuantity}
              onStatus={(entry, status) => {
                setEntries((current) => current.map((item) => item.id === entry.id ? { ...item, status } : item));
                setNotice({ type: "success", text: "状态已更新到本地草稿" });
              }}
              onDelete={requestDelete}
            />;
          })}
        </section>

      </div>

      {mealPicker && <MealPicker
        resourceName={mealPicker.name}
        disabled={pending}
        onClose={() => setMealPicker(null)}
        onSelect={(slot) => {
          addResource(mealPicker.payload, slot);
          setMealPicker(null);
        }}
      />}
      {foodEditor && <FoodEditor food={foodEditor === "new" ? null : foodEditor} onClose={() => setFoodEditor(null)} onSave={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const portions = form.get("common_portions")?.toString().split(",").map((part) => {
          const [label, multiplier] = part.split("=");
          return { label: label?.trim() ?? "", multiplier: Number(multiplier) };
        }).filter((portion) => portion.label && portion.multiplier > 0) ?? [];
        const categoryTag = form.get("category")?.toString();
        const tags = form.get("tags")?.toString().split(/[,，]/).map((value) => value.trim()).filter(Boolean) ?? [];
        if (categoryTag && !tags.includes(categoryTag)) tags.unshift(categoryTag);
        run(() => saveFood({
          id: foodEditor === "new" ? undefined : foodEditor.id,
          name: form.get("name")?.toString() ?? "",
          standardAmount: Number(form.get("standard_amount")),
          standardUnit: form.get("standard_unit")?.toString() ?? "",
          caloriesKcal: Number(form.get("calories_kcal")),
          proteinG: nullableFormNumber(form, "protein_g"),
          carbsG: nullableFormNumber(form, "carbs_g"),
          fatG: nullableFormNumber(form, "fat_g"),
          fiberG: nullableFormNumber(form, "fiber_g"),
          caffeineMg: nullableFormNumber(form, "caffeine_mg"),
          tags,
          commonPortions: portions,
        }), "食物库已保存");
        setFoodEditor(null);
      }} />}
      {estimateSlot && <EstimateEditor slot={estimateSlot} defaultStatus={defaultDietStatus(date, today)} onClose={() => setEstimateSlot(null)} onSave={(input) => {
        const groupId = crypto.randomUUID();
        const draftEstimate: DietEntry = {
          id: crypto.randomUUID(),
          record_date: date,
          meal_slot: estimateSlot,
          status: input.status,
          source_kind: "meal_estimate",
          source_id: null,
          group_id: groupId,
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
          created_at: new Date().toISOString(),
        };
        setEntries((current) => [...current, draftEstimate]);
        setNotice({ type: "success", text: "外食估算已加入本地草稿" });
        setEstimateSlot(null);
      }} />}
      {templateDraft && <TemplateEditor
        kind={templateDraft.kind}
        templates={templates.filter((template) => template.kind === templateDraft.kind && !template.archived)}
        selectedEntries={entries.filter((entry) => templateDraft.entryIds.includes(entry.id))}
        sourceLabel={templateDraft.sourceLabel}
        onClose={() => setTemplateDraft(null)}
        onSave={(input) => {
          run(() => saveDietTemplate({ ...input, kind: templateDraft.kind, entryIds: templateDraft.entryIds }), `${templateDraft.kind === "menu" ? "菜单" : "组合"}已保存`);
          if (templateDraft.kind === "combination") setSelected(new Set());
          setTemplateDraft(null);
        }}
      />}
      {targetEditor && <TargetEditor targets={targets} currentWeight={currentWeight} currentWeightDate={currentWeightDate} activeEnergyKcal={activeEnergyKcal} onClose={() => setTargetEditor(false)} onSave={(next) => {
        run(() => saveNutritionTargets(next), "营养目标已保存");
        setTargetEditor(false);
      }} />}
    </>
  );
}

function MealCard({
  slot, label, entries, calories, selected, disabled, onDrop, onEstimate, onSaveMenu, onSelect, onQuantity, onStatus, onDelete,
}: {
  slot: MealSlot;
  label: string;
  entries: DietEntry[];
  calories: number;
  selected: Set<string>;
  disabled: boolean;
  onDrop: (payload: ResourcePayload) => void;
  onEstimate: () => void;
  onSaveMenu: () => void;
  onSelect: (id: string) => void;
  onQuantity: (entry: DietEntry, quantity: number) => void;
  onStatus: (entry: DietEntry, status: DietEntryStatus) => void;
  onDelete: (entry: DietEntry) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const toggleExpanded = (id: string) => setExpandedEntries((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    try {
      const payload = JSON.parse(event.dataTransfer.getData("application/daymark-diet")) as ResourcePayload;
      if (payload.id && ["food", "combination", "menu"].includes(payload.kind)) onDrop(payload);
    } catch { /* Ignore unrelated drag payloads. */ }
  };
  return <Card
    className={`diet-meal surface gap-0 py-0 ${dragOver ? "drag-over" : ""}`}
    onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
    onDragLeave={() => setDragOver(false)}
    onDrop={handleDrop}
  >
    <div className="diet-meal-heading"><div><span className="diet-meal-icon">{slot === "breakfast" ? "早" : slot === "lunch" ? "午" : slot === "dinner" ? "晚" : "加"}</span><div><h2>{label}</h2><small>{entries.length ? `${entries.length} 项记录` : "拖入食物、组合或菜单"}</small></div></div><div><b>{formatValue(calories)}</b><span>kcal 已摄入</span></div></div>
    {entries.length === 0 && <div className="diet-meal-empty">把左侧资源拖到这里，或点击资源后选择当前餐次。</div>}
    <div className="diet-entry-list">
      {entries.map((entry) => {
        const expanded = expandedEntries.has(entry.id);
        const quantityDraft = quantityDrafts[entry.id] ?? String(entry.quantity);
        const parsedQuantity = Number(quantityDraft);
        const quantityChanged = Number.isFinite(parsedQuantity) && parsedQuantity > 0 && parsedQuantity !== entry.quantity;
        return <div className={`diet-entry ${entry.status} ${expanded ? "expanded" : ""}`} key={entry.id}>
          <label className="diet-entry-select" title="选择后保存为常用组合"><input type="checkbox" checked={selected.has(entry.id)} disabled={!entry.food_id} onChange={() => onSelect(entry.id)} /></label>
          <button className="diet-entry-summary" type="button" onClick={() => toggleExpanded(entry.id)} aria-expanded={expanded}>
            <span className="diet-entry-copy"><span><b>{entry.name_snapshot}</b>{entry.estimated && <i>估算</i>}</span><small>{formatValue(entry.standard_amount_snapshot * entry.quantity)} {entry.standard_unit_snapshot} · {formatValue(entry.calories_kcal_snapshot * entry.quantity)} kcal{entry.note ? ` · ${entry.note}` : ""}</small></span>
            <span className={`diet-entry-status ${entry.status}`}>{entry.status === "consumed" ? "已摄入" : "计划"}</span>
            <ChevronRight className="diet-entry-chevron" />
          </button>
          <button className="diet-entry-quick-delete" disabled={disabled} onClick={() => onDelete(entry)} aria-label={`删除${entry.name_snapshot}`} title="从本地草稿移除"><Trash2 /></button>
          {expanded && <div className="diet-entry-controls">
            <div className="diet-entry-control-row">
              <div className="diet-status-toggle"><button className={entry.status === "consumed" ? "active" : ""} disabled={disabled} onClick={() => onStatus(entry, "consumed")}>已摄入</button><button className={entry.status === "planned" ? "active" : ""} disabled={disabled} onClick={() => onStatus(entry, "planned")}>计划</button></div>
              {!entry.estimated && <div className="diet-quantity-editor">
                <div className="diet-quantity"><div className="diet-stepper"><button type="button" disabled={disabled || parsedQuantity <= 1} onClick={() => setQuantityDrafts((current) => ({ ...current, [entry.id]: String(Math.max(1, (Number(current[entry.id] ?? entry.quantity) || 1) - 1)) }))} aria-label={`${entry.name_snapshot}减少1份`}><Minus /></button><Input aria-label={`${entry.name_snapshot}份数`} type="number" min="0.1" max="100" step="1" value={quantityDraft} disabled={disabled} onChange={(event) => setQuantityDrafts((current) => ({ ...current, [entry.id]: event.target.value }))} /><button type="button" disabled={disabled || parsedQuantity >= 100} onClick={() => setQuantityDrafts((current) => ({ ...current, [entry.id]: String(Math.min(100, (Number(current[entry.id] ?? entry.quantity) || 0) + 1)) }))} aria-label={`${entry.name_snapshot}增加1份`}><Plus /></button></div>{entry.portion_options_snapshot.length > 0 && <select value="" disabled={disabled} onChange={(event) => { if (event.target.value) setQuantityDrafts((current) => ({ ...current, [entry.id]: event.target.value })); }}><option value="">选择常用份量</option>{entry.portion_options_snapshot.map((portion) => <option value={portion.multiplier} key={`${portion.label}-${portion.multiplier}`}>{portion.label}</option>)}</select>}</div>
                <div className="diet-quantity-actions"><Button size="sm" disabled={disabled || !quantityChanged} onClick={() => {
                  onQuantity(entry, parsedQuantity);
                  setQuantityDrafts((current) => {
                    const next = { ...current };
                    delete next[entry.id];
                    return next;
                  });
                }}><Check />应用份量</Button><Button size="sm" variant="ghost" disabled={!quantityChanged} onClick={() => setQuantityDrafts((current) => ({ ...current, [entry.id]: String(entry.quantity) }))}>取消</Button></div>
              </div>}
            </div>
          </div>}
        </div>;
      })}
    </div>
    <div className="diet-meal-footer"><div className="diet-meal-footer-actions"><Button size="sm" variant="ghost" disabled={disabled} onClick={onEstimate}><Coffee />添加外食估算</Button><Button size="sm" variant="ghost" disabled={disabled || !entries.some((entry) => entry.food_id)} onClick={onSaveMenu}><Save />整餐保存为菜单</Button></div><span>{entries.some((entry) => entry.estimated) ? "外食估算不会进入菜单；今日改动统一保存" : "增删与份量调整只更新本页，统一保存后写入"}</span></div>
  </Card>;
}

function NutritionPanel({ entries, targets, activeEnergyKcal, onEditTargets }: { entries: DietEntry[]; targets: NutritionTargets; activeEnergyKcal: number | null; onEditTargets: () => void }) {
  const actual = summarizeDietEntries(entries);
  const projected = summarizeDietEntries(entries, true);
  const hasPlannedEntries = entries.some((entry) => entry.status === "planned");
  const dailyCalorieTarget = calculateDailyCalorieTarget(targets.resting_metabolism_kcal, activeEnergyKcal, targets.calorie_deficit_kcal);
  const effectiveTargets = { ...targets, calories_kcal: dailyCalorieTarget };
  const calorieBudgetDetail = `${formatValue(targets.resting_metabolism_kcal)} 基础 + ${activeEnergyKcal === null ? "—" : formatValue(activeEnergyKcal)} 活动 − ${formatValue(targets.calorie_deficit_kcal)} 缺口`;
  return <Card className="diet-nutrition surface gap-0 py-0">
    <div className="diet-panel-title"><div><Utensils /><span><b>当日营养</b><small>优先显示剩余可摄入，实际与计划分开</small></span></div><Button size="icon-sm" variant="ghost" onClick={onEditTargets} aria-label="编辑营养目标"><Pencil /></Button></div>
    <div className={`diet-nutrition-content ${hasPlannedEntries ? "has-projected" : ""}`}>
      <NutritionSet title="实际摄入" values={actual.values} partial={actual.partial} targets={effectiveTargets} calorieBudgetDetail={calorieBudgetDetail} />
      {hasPlannedEntries && <NutritionSet title="含计划预计" values={projected.values} partial={projected.partial} targets={effectiveTargets} compact calorieBudgetDetail={calorieBudgetDetail} />}
    </div>
    <div className="diet-nutrition-footer">
      <div className="diet-nutrition-note">
        <p><b>{actual.mealCount}</b> 个已摄入餐段</p>
        <p><b>{actual.entryCount}</b> 项实际记录</p>
        {actual.hasEstimate && <p className="estimated"><b>{formatValue(actual.estimatedCalories)}</b> kcal 来自估算</p>}
        {actual.values.caffeine_mg > 0 && <p><b>{formatValue(actual.values.caffeine_mg)}</b> mg 咖啡因</p>}
      </div>
      <button className="diet-target-link" onClick={onEditTargets}>设置营养目标<ChevronRight /></button>
    </div>
  </Card>;
}

function NutritionSet({ title, values, partial, targets, compact = false, calorieBudgetDetail }: {
  title: string;
  values: Record<DietNutrientKey, number>;
  partial: Record<DietNutrientKey, boolean>;
  targets: NutritionTargets;
  compact?: boolean;
  calorieBudgetDetail: string;
}) {
  return <section className={`diet-nutrient-set ${compact ? "compact" : ""}`}><h3>{title}</h3><div className="diet-nutrient-grid">
    {coreNutrientKeys.map((key) => {
      const target = targets[key];
      const value = values[key];
      const isCalories = key === "calories_kcal";
      const remainingCalories = isCalories && target !== null ? Math.max(0, Math.round(target - value)) : null;
      const displayValue = isCalories
        ? remainingCalories === null ? "—" : String(remainingCalories)
        : partial[key] && value === 0 ? "—" : formatValue(value);
      const ratio = target ? Math.min(value / target, 1) : 0;
      const calorieStatus = target === null
        ? "活动消耗未同步，暂不能计算"
        : value > target
          ? `目标 ${formatValue(target)} kcal · ${compact ? "预计" : "已"}超出 ${formatValue(value - target)} kcal`
          : `目标 ${formatValue(target)} kcal · ${compact ? "预计摄入" : "已摄入"} ${formatValue(value)} kcal`;
      return <div className={`diet-nutrient-card ${isCalories ? "primary" : ""}`} key={key}>
        <div className="diet-nutrient-label"><b>{isCalories ? compact ? "预计剩余" : "剩余可摄入" : nutrientMeta[key].label}</b>{partial[key] && <em>部分未知</em>}</div>
        <div className="diet-nutrient-value"><strong>{displayValue}</strong><span>{nutrientMeta[key].unit}</span></div>
        <div className="diet-nutrient-progress" aria-hidden="true"><i style={{ width: `${ratio * 100}%` }} /></div>
        <small>{isCalories ? calorieStatus : target !== null ? `目标 ${formatValue(target)} ${nutrientMeta[key].unit}` : "未设置目标"}</small>
        {isCalories && <small className="diet-calorie-formula">{calorieBudgetDetail}</small>}
      </div>;
    })}
  </div></section>;
}

function MealPicker({ resourceName, disabled, onClose, onSelect }: {
  resourceName: string;
  disabled: boolean;
  onClose: () => void;
  onSelect: (slot: MealSlot) => void;
}) {
  return <Modal title={`加入“${resourceName}”`} description="选择要记录的餐次。你也可以关闭窗口，直接把资源拖到对应餐次。" onClose={onClose}>
    <div className="diet-meal-picker">
      {mealSlots.map((slot) => <button key={slot.value} disabled={disabled} onClick={() => onSelect(slot.value)}><span>{slot.label}</span><ChevronRight /></button>)}
    </div>
  </Modal>;
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="diet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="diet-modal" role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{description}</p></div><Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭"><X /></Button></header>{children}</section></div>;
}

function FoodEditor({ food, onClose, onSave }: { food: FoodItem | null; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void }) {
  const taggedCategory = Object.keys(foodCategoryLabels).find((value) => food?.tags.includes(value));
  const initialCategory = food?.caffeine_mg ? "drinks" : taggedCategory ?? "other";
  const [category, setCategory] = useState(initialCategory);
  const otherTags = food?.tags.filter((tag) => !Object.keys(foodCategoryLabels).includes(tag)).join(", ") ?? "";
  const portions = food?.common_portions.map((portion) => `${portion.label}=${portion.multiplier}`).join(", ") ?? "";
  return <Modal title={food ? "编辑食物" : "新增食物"} description="热量必填；不知道的营养值请留空，不要填写 0。" onClose={onClose}>
    <form className="diet-form" onSubmit={onSave}>
      <div className="diet-form-grid two"><label><span>食物名称 *</span><Input name="name" required maxLength={80} defaultValue={food?.name} /></label><label><span>所属区域</span><select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>{Object.entries(foodCategoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <div className="diet-form-grid three"><label><span>标准份量 *</span><Input name="standard_amount" type="number" min="0.01" step="0.01" required defaultValue={food?.standard_amount} /></label><label><span>单位 *</span><Input name="standard_unit" required placeholder="g / 个 / 杯" defaultValue={food?.standard_unit} /></label><label><span>热量 kcal *</span><Input name="calories_kcal" type="number" min="0" step="0.1" required defaultValue={food?.calories_kcal} /></label></div>
      <div className="diet-form-grid two nutrient-fields"><label><span>蛋白质 g</span><Input name="protein_g" type="number" min="0" step="0.1" defaultValue={food?.protein_g ?? ""} /></label><label><span>碳水 g</span><Input name="carbs_g" type="number" min="0" step="0.1" defaultValue={food?.carbs_g ?? ""} /></label><label><span>脂肪 g</span><Input name="fat_g" type="number" min="0" step="0.1" defaultValue={food?.fat_g ?? ""} /></label><label><span>膳食纤维 g</span><Input name="fiber_g" type="number" min="0" step="0.1" defaultValue={food?.fiber_g ?? ""} /></label></div>
      {category === "drinks" && <label><span>咖啡因 mg</span><Input name="caffeine_mg" type="number" min="0" step="0.1" defaultValue={food?.caffeine_mg ?? ""} /><small>咖啡因仅在“饮品”类别中显示和编辑。</small></label>}
      <label><span>其他标签</span><Input name="tags" placeholder="早餐, 常用, 高蛋白" defaultValue={otherTags} /></label>
      <label><span>常用份量</span><Input name="common_portions" placeholder="半份=0.5, 大杯=1.5" defaultValue={portions} /><small>格式：显示名称=标准份数，用逗号分隔。</small></label>
      <footer><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="submit"><Save />保存食物</Button></footer>
    </form>
  </Modal>;
}

function EstimateEditor({ slot, defaultStatus, onClose, onSave }: {
  slot: MealSlot;
  defaultStatus: DietEntryStatus;
  onClose: () => void;
  onSave: (input: { caloriesKcal: number; label: string; note?: string; status: DietEntryStatus }) => void;
}) {
  const [preset, setPreset] = useState("1000");
  return <Modal title="添加外食估算" description={`${mealSlots.find((item) => item.value === slot)?.label}只记录热量估计，其他营养值保持未知。`} onClose={onClose}>
    <form className="diet-form" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const calories = preset === "custom" ? Number(form.get("custom_calories")) : Number(preset);
      onSave({ caloriesKcal: calories, label: preset === "700" ? "较轻" : preset === "1000" ? "常规" : preset === "1500" ? "较重" : "自定义", note: form.get("note")?.toString(), status: form.get("status") as DietEntryStatus });
    }}>
      <div className="diet-estimate-options">{[{ value: "700", label: "较轻", sub: "700 kcal" }, { value: "1000", label: "常规", sub: "1000 kcal" }, { value: "1500", label: "较重", sub: "1500 kcal" }, { value: "custom", label: "自定义", sub: "手动输入" }].map((item) => <label className={preset === item.value ? "active" : ""} key={item.value}><input type="radio" name="preset" value={item.value} checked={preset === item.value} onChange={() => setPreset(item.value)} /><b>{item.label}</b><span>{item.sub}</span></label>)}</div>
      {preset === "custom" && <label><span>估算热量 *</span><Input name="custom_calories" type="number" min="1" max="10000" required /></label>}
      <div className="diet-form-grid two"><label><span>记录状态</span><select name="status" defaultValue={defaultStatus}><option value="consumed">已摄入</option><option value="planned">计划</option></select></label></div>
      <label><span>备注（可选）</span><Textarea name="note" maxLength={200} placeholder="餐厅、菜品或估算依据" /></label>
      <footer><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="submit">加入餐次</Button></footer>
    </form>
  </Modal>;
}

function TemplateEditor({ kind, templates, selectedEntries, sourceLabel, onClose, onSave }: {
  kind: DietTemplateKind;
  templates: DietTemplate[];
  selectedEntries: DietEntry[];
  sourceLabel: string;
  onClose: () => void;
  onSave: (input: { name: string; tags: string[]; templateId?: string }) => void;
}) {
  const [templateId, setTemplateId] = useState("");
  const selectedTemplate = templates.find((template) => template.id === templateId);
  return <Modal title={kind === "menu" ? "保存整餐菜单" : "保存常用组合"} description={kind === "menu" ? "菜单保存当前餐次的全部可复用食物；当天后续修改不会反向改变菜单。" : "组合只保存当前餐次中明确勾选的食物，可在任何餐次重复加入。"} onClose={onClose}>
    <form className="diet-form" key={templateId || "new"} onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      onSave({ name: form.get("name")?.toString() ?? "", tags: form.get("tags")?.toString().split(/[,，]/).filter(Boolean) ?? [], templateId: templateId || undefined });
    }}>
      <section className="diet-template-preview"><header><b>{kind === "menu" ? "整餐内容" : "所选组合"}</b><span>{sourceLabel} · {selectedEntries.length} 项</span></header><div>{selectedEntries.map((entry) => <p key={entry.id}><span>{entry.name_snapshot}</span><b>× {formatValue(entry.quantity)}</b></p>)}</div></section>
      <label><span>保存方式</span><select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">创建新的{kind === "menu" ? "菜单" : "组合"}</option>{templates.map((template) => <option key={template.id} value={template.id}>替换已有：{template.name}</option>)}</select><small>{templateId ? "保存后会整体替换所选模板的食物和份量。" : "创建后会作为独立资源保留，不影响当天记录。"}</small></label>
      <label><span>名称 *</span><Input name="name" required maxLength={80} defaultValue={selectedTemplate?.name} /></label>
      <label><span>标签</span><Input name="tags" placeholder={kind === "menu" ? "午餐, 减脂, 快手" : "高蛋白, 常用"} defaultValue={selectedTemplate?.tags.join(", ")} /></label>
      <footer><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="submit"><Save />{templateId ? "确认替换" : "创建"}</Button></footer>
    </form>
  </Modal>;
}

function TargetEditor({ targets, currentWeight, currentWeightDate, activeEnergyKcal, onClose, onSave }: {
  targets: NutritionTargets;
  currentWeight: number | null;
  currentWeightDate: string | null;
  activeEnergyKcal: number | null;
  onClose: () => void;
  onSave: (targets: NutritionTargets) => void;
}) {
  const hasSavedTargets = macroTargetKeys.some((key) => targets[key] !== null);
  const [draft, setDraft] = useState<NutritionTargets>(() => {
    const calorieTarget = calculateDailyCalorieTarget(targets.resting_metabolism_kcal, activeEnergyKcal, targets.calorie_deficit_kcal);
    return !hasSavedTargets && currentWeight !== null
      ? { ...targets, ...suggestMacrosFromWeight(currentWeight, calorieTarget ?? targets.resting_metabolism_kcal - targets.calorie_deficit_kcal), calories_kcal: null, caffeine_mg: null }
      : targets;
  });
  const draftCalorieTarget = calculateDailyCalorieTarget(draft.resting_metabolism_kcal, activeEnergyKcal, draft.calorie_deficit_kcal);
  const refreshMacros = () => {
    if (currentWeight === null) return;
    setDraft((current) => ({ ...current, ...suggestMacrosFromWeight(currentWeight, draftCalorieTarget ?? current.resting_metabolism_kcal - current.calorie_deficit_kcal) }));
  };
  return <Modal title="营养目标" description="每日热量由基础代谢、当天活动消耗和你设定的缺口动态计算；宏量目标仍可单独调整。" onClose={onClose}>
    <form className="diet-form" onSubmit={(event) => {
      event.preventDefault();
      onSave({ ...draft, calories_kcal: null, caffeine_mg: null });
    }}>
      <section className="diet-energy-editor"><div><span>今日动态目标</span><b>{draftCalorieTarget === null ? "等待活动数据" : `${draftCalorieTarget} kcal`}</b><small>{formatValue(draft.resting_metabolism_kcal)} 基础 + {activeEnergyKcal === null ? "—" : formatValue(activeEnergyKcal)} 活动 − {formatValue(draft.calorie_deficit_kcal)} 缺口</small></div><div className="diet-form-grid two"><label><span>基础代谢 · kcal</span><Input type="number" min="800" max="5000" step="10" value={draft.resting_metabolism_kcal} onChange={(event) => setDraft((current) => ({ ...current, resting_metabolism_kcal: Number(event.target.value) }))} /></label><label><span>每日缺口 · kcal</span><Input type="number" min="0" max="1500" step="50" value={draft.calorie_deficit_kcal} onChange={(event) => setDraft((current) => ({ ...current, calorie_deficit_kcal: Number(event.target.value) }))} /></label></div></section>
      <section className="diet-weight-targets"><div><b>{currentWeight === null ? "暂无可用体重" : `${formatValue(currentWeight)} kg`}</b><span>{currentWeightDate ? `最近记录于 ${currentWeightDate}` : "请先在身体模块记录体重"}</span></div><div><button type="button" disabled={currentWeight === null} onClick={refreshMacros}>按体重更新宏量目标</button></div></section>
      <div className="diet-form-grid two">{macroTargetKeys.map((key) => <label key={key}><span>{nutrientMeta[key].label}目标 · {nutrientMeta[key].unit}</span><Input name={key} type="number" min="0.1" step="0.1" value={draft[key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value === "" ? null : Number(event.target.value) }))} /></label>)}</div>
      <p className="diet-form-help">当前活动消耗来自所选日期已同步到后台的数据，今天尚未结束时会继续变化。基础代谢默认采用你提供的约 1600 kcal；缺口默认 300 kcal，可自行修改。咖啡因不再作为通用营养目标，仅在饮品有记录时展示。</p>
      <footer><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="submit"><Save />保存目标</Button></footer>
    </form>
  </Modal>;
}
