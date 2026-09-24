import "server-only";
import { prisma } from "@/lib/db";

export async function deleteExpiredPopups(now=new Date()){
  return prisma.notification.deleteMany({where:{kind:"POPUP",expiresAt:{lte:now}}});
}
