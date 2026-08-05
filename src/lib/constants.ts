export const sleepQualityOptions = [
  ["very_poor", "很差", "多次醒来或几乎没恢复"],
  ["poor", "较差", "睡了，但恢复感较弱"],
  ["average", "一般", "没有明显好或坏"],
  ["good", "良好", "整体连续且有恢复感"],
  ["very_good", "很好", "醒来明显感到恢复"],
] as const;

export const clarityOptions = [
  ["heavy_brain_fog", "脑雾明显", "很难聚焦或开始思考"],
  ["tired", "有些疲惫", "可以工作，但启动较慢"],
  ["normal", "正常", "能按常规节奏推进"],
  ["clear", "清醒", "思路流畅、注意稳定"],
  ["very_clear", "非常清醒", "精力和认知状态都很好"],
] as const;

export const taskIntensityOptions = [
  ["low", "低强度", "恢复优先，减少开放式任务"],
  ["medium", "中强度", "维持正常节奏，保留余量"],
  ["high", "高强度", "适合推进关键认知工作"],
] as const;

export const violationReasons = [
  ["unfinished_pre_20_task", "延续 20:00 前未完成的任务"],
  ["new_idea_to_validate", "出现了想立即验证的新想法"],
  ["unable_to_stop", "已经开始后停不下来"],
  ["thought_it_would_be_quick", "以为很快就能完成"],
  ["compensate_for_low_daytime_progress", "想弥补白天进度"],
  ["mentally_excited", "精神兴奋，主动继续工作"],
  ["urgent_event", "有紧急事件"],
  ["intentional_exception", "提前决定的例外"],
  ["other", "其他"],
] as const;

export const labels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  very_poor: "很差",
  poor: "较差",
  average: "一般",
  good: "良好",
  very_good: "很好",
  heavy_brain_fog: "脑雾明显",
  tired: "有些疲惫",
  normal: "正常",
  clear: "清醒",
  very_clear: "非常清醒",
  insufficient: "不足",
  roughly_enough: "大致够",
  sufficient: "充足",
  none: "几乎没有",
  small: "少量",
  significant: "明显",
  moderate: "适中",
  excessive: "明显过多",
};
