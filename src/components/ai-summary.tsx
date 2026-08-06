"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Summary = { current: string; reasons: string[]; limitations: string[]; generatedBy?: string };

export function AiSummary({ initial, enabled }: { initial: Summary; enabled: boolean }) {
  const [summary, setSummary] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function regenerate() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/ai-summary", { method: "POST" });
      if (!response.ok) throw new Error("生成失败");
      setSummary(await response.json());
    } catch {
      setError("暂时无法生成，已保留上一次结构化总结。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="surface ai-card gap-0 py-0">
      <div className="ai-title">
        <h2><Sparkles size={18} color="#1f7468" /> {summary.generatedBy === "ai" ? "AI 趋势总结" : "结构化趋势总结"}</h2>
        {enabled && <Button variant="outline" size="sm" type="button" onClick={regenerate} disabled={loading}><RefreshCw size={13} className={loading ? "spin" : ""} />{loading ? "生成中" : "重新生成"}</Button>}
      </div>
      {error && <Alert variant="destructive" className="mt-4"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="ai-copy">
        <div><h3>当前趋势</h3><p>{summary.current}</p></div>
        <div><h3>主要可能信号</h3><ul>{summary.reasons.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>数据限制</h3><ul>{summary.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
    </Card>
  );
}
