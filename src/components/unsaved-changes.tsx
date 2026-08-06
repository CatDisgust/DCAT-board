"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type UnsavedChangesValue = {
  dirty: boolean;
  markDirty: () => void;
  resetDirty: () => void;
  requestNavigation: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback(() => setDirty(true), []);
  const resetDirty = useCallback(() => setDirty(false), []);
  const requestNavigation = useCallback(() => {
    if (!dirty) return true;
    if (!window.confirm("当前页面有尚未保存的修改。确定放弃这些修改吗？")) return false;
    setDirty(false);
    return true;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const value = useMemo(
    () => ({ dirty, markDirty, resetDirty, requestNavigation }),
    [dirty, markDirty, resetDirty, requestNavigation],
  );

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const value = useContext(UnsavedChangesContext);
  if (!value) throw new Error("useUnsavedChanges must be used inside UnsavedChangesProvider");
  return value;
}
