import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { PROFILE_AVATAR_KEYS } from "@/lib/profile-avatars";

const input = z.object({ avatar: z.enum(PROFILE_AVATAR_KEYS) });

export async function PATCH(request: Request) {
  try {
    const { student } = await requireStudent();
    const { avatar } = input.parse(await request.json());
    await prisma.user.update({
      where: { id: student.id },
      data: { profileAvatar: avatar },
      select: { id: true },
    });
    return NextResponse.json({ avatar });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Escolha uma foto de perfil disponível." }, { status: 400 });
    }
    const [message, status] = apiError(error);
    return NextResponse.json({ message }, { status });
  }
}
