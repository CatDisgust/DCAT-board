"use client";

import { Save } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function InlineSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}><Save />{pending ? "保存中…" : label}</Button>;
}
