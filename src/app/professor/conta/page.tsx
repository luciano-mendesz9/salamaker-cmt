import { ProfessorShell } from "@/components/professor-shell";
import { TeacherPasswordForm } from "@/components/teacher-password-form";
import { requireTeacher } from "@/lib/authorization";

export default async function TeacherAccountPage() {
  await requireTeacher();
  return <ProfessorShell title="Minha conta"><TeacherPasswordForm/></ProfessorShell>;
}
