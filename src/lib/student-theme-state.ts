import { prisma } from "@/lib/db";
import { getCollectiblesReadiness } from "@/lib/feature-readiness";
import { DEFAULT_STUDENT_THEME, normalizeStudentTheme, type StudentThemeKey } from "@/lib/student-themes";

export type StudentThemeState = {
  activeTheme: StudentThemeKey;
  ownedThemes: StudentThemeKey[];
  storeReady: boolean;
};

export async function getStudentThemeState(studentId: string): Promise<StudentThemeState> {
  const readiness = await getCollectiblesReadiness().catch(() => null);
  if (!readiness?.studentThemes) {
    return { activeTheme: DEFAULT_STUDENT_THEME, ownedThemes: [DEFAULT_STUDENT_THEME], storeReady: false };
  }

  const purchases = await prisma.studentThemePurchase.findMany({
    where: { studentId },
    select: { themeKey: true, selectedAt: true },
    orderBy: [{ selectedAt: "desc" }, { purchasedAt: "asc" }],
  });
  const ownedThemes = [DEFAULT_STUDENT_THEME, ...purchases.map(({ themeKey }) => normalizeStudentTheme(themeKey))]
    .filter((key, index, keys) => keys.indexOf(key) === index);
  const selected = purchases.find(({ selectedAt }) => selectedAt)?.themeKey;
  return { activeTheme: normalizeStudentTheme(selected), ownedThemes, storeReady: true };
}
