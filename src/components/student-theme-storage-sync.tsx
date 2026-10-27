"use client";

import { useEffect } from "react";
import { STUDENT_THEME_STORAGE_KEY, type StudentThemeKey } from "@/lib/student-themes";

export function StudentThemeStorageSync({ studentId, theme }: { studentId: string; theme: StudentThemeKey }) {
  useEffect(() => {
    try { localStorage.setItem(STUDENT_THEME_STORAGE_KEY, JSON.stringify({ studentId, theme })); } catch {}
  }, [studentId, theme]);
  return null;
}
