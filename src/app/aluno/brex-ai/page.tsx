import { requireStudent } from "@/lib/authorization";
import { BrexChat } from "@/components/brex-chat";

export default async function BrexPage() {
  const { student } = await requireStudent();
  return <BrexChat firstName={student.firstName}/>;
}
