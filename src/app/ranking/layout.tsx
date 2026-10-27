import { LudoRealtimeBridge } from "@/components/ludo-realtime-bridge";
import { StudentThemeStorageSync } from "@/components/student-theme-storage-sync";
import { getOptionalStudent } from "@/lib/authorization";
import { getStudentThemeState } from "@/lib/student-theme-state";
import { DEFAULT_STUDENT_THEME } from "@/lib/student-themes";

export default async function RankingLayout({ children }: { children: React.ReactNode }) {
  const student = await getOptionalStudent();
  const theme = student ? (await getStudentThemeState(student.id)).activeTheme : DEFAULT_STUDENT_THEME;

  return <div className="student-theme-root min-h-screen" data-student-theme={theme}>
    {student && <StudentThemeStorageSync studentId={student.id} theme={theme}/>}
    {children}
    {student && <LudoRealtimeBridge/>}
  </div>;
}
