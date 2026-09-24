import { apiError, requireTeacher } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { createStudentsWorkbook } from "@/lib/student-export";

export async function GET() {
  try {
    await requireTeacher();

    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        firstName: true,
        lastName: true,
        accessCode: true,
        originSchoolClass: true,
        xp: true,
      },
      orderBy: [
        { originSchoolClass: "asc" },
        { firstName: "asc" },
        { lastName: "asc" },
      ],
    });

    const file = createStudentsWorkbook(students);
    const date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Fortaleza",
    }).format(new Date());

    return new Response(file as BodyInit, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="alunos-sala-maker-${date}.xlsx"`,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    const [message, status] = apiError(error);
    return Response.json({ message }, { status });
  }
}
