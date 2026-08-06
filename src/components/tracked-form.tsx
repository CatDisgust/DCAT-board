"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/components/unsaved-changes";

type ServerFormAction = (formData: FormData) => void | Promise<void>;

export function TrackedForm({
  action,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "children"> & {
  action: ServerFormAction;
  children: ReactNode;
}) {
  const { markDirty, resetDirty } = useUnsavedChanges();

  useEffect(() => resetDirty(), [resetDirty]);

  return (
    <form action={action} onChangeCapture={markDirty} {...props}>
      {children}
    </form>
  );
}

export function FormSaveBar({ submitLabel }: { submitLabel: string }) {
  const { pending } = useFormStatus();
  const { dirty, requestNavigation } = useUnsavedChanges();

  const handleCancel = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!requestNavigation()) event.preventDefault();
  };

  return (
    <div className="form-actions">
      <div className={`form-save-status ${dirty ? "dirty" : ""}`} aria-live="polite">
        {pending ? <LoaderCircle className="spin" /> : dirty ? <CircleAlert /> : <CircleCheck />}
        <span>
          <b>{pending ? "正在保存" : dirty ? "有未保存的修改" : "当前内容已加载"}</b>
          <small>{pending ? "正在写入数据库并更新分析" : dirty ? "离开前请保存，否则修改会丢失" : "修改任意字段后，状态会在这里提示"}</small>
        </span>
      </div>
      <div className="form-action-buttons">
        <Button asChild variant="outline" size="lg"><Link href="/" onClick={handleCancel}>取消</Link></Button>
        <Button className="min-w-42" size="lg" type="submit" disabled={pending}>
          {pending && <LoaderCircle className="spin" />}{pending ? "保存中…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
