import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { analyzeRecords, ruleBasedNarrative } from "@/lib/analytics";
import { getAppData } from "@/lib/data";

export async function POST() {
  const { profile, records } = await getAppData(28);
  const analysis = analyzeRecords(records);
  const fallback = { ...ruleBasedNarrative(analysis), generatedBy: "rules" };
  if (!profile.ai_analysis_enabled || !process.env.OPENAI_API_KEY) return NextResponse.json(fallback);

  const payload = {
    window: "recent_7_calendar_days",
    completeness: analysis.completeness,
    diet: analysis.diet,
    sleep: analysis.sleep,
    boundary: analysis.boundary,
  };
  const safetyIdentifier = createHash("sha256").update(profile.email ?? "single-user-dashboard").digest("hex").slice(0, 32);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.6-terra",
      reasoning: { effort: "low" },
      store: false,
      safety_identifier: safetyIdentifier,
      input: [
        { role: "system", content: "你是个人状态数据分析器。只能使用给定结构化结果；不得补充事实、医疗诊断或把相关性写成因果。使用简洁中文。输出严格 JSON：current 字符串、reasons 字符串数组（最多3项）、limitations 字符串数组。" },
        { role: "user", content: JSON.stringify(payload) },
      ],
      text: { format: { type: "json_schema", name: "dashboard_summary", strict: true, schema: { type: "object", additionalProperties: false, properties: { current: { type: "string" }, reasons: { type: "array", items: { type: "string" }, maxItems: 3 }, limitations: { type: "array", items: { type: "string" } } }, required: ["current", "reasons", "limitations"] } } },
    }),
  });
  if (!response.ok) return NextResponse.json(fallback);
  const json = await response.json();
  try {
    const text = json.output?.flatMap((item: { content?: { text?: string }[] }) => item.content ?? []).find((item: { text?: string }) => item.text)?.text;
    const parsed = JSON.parse(text);
    return NextResponse.json({ ...parsed, generatedBy: "ai" });
  } catch {
    return NextResponse.json(fallback);
  }
}
