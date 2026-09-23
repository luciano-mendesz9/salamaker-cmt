import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ActivityCreateForm } from "@/components/activity-create-form";
import { ProfessorShell } from "@/components/professor-shell";
import { prisma } from "@/lib/db";

export default async function NovaAtividade(){
  const [students,settings]=await Promise.all([prisma.user.findMany({where:{role:"STUDENT",status:"ACTIVE"},select:{id:true,firstName:true,lastName:true,originSchoolClass:true},orderBy:[{originSchoolClass:"asc"},{firstName:"asc"},{lastName:"asc"}]}),prisma.appSetting.findUnique({where:{id:1},select:{timeZone:true}})]);
  return <ProfessorShell title="Nova atividade"><Link href="/professor/atividades" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16}/>Voltar</Link><p className="eyebrow mt-6">Publicação</p><h2 className="mt-3 font-display text-3xl font-bold">Criar atividade</h2><p className="mt-2 max-w-3xl text-sm text-slate-400">Todos os alunos ativos da única turma de Robótica serão registrados como destinatários, independentemente da turma regular de origem. Alterações estruturais de formulário não são permitidas depois disso.</p><ActivityCreateForm students={students} timeZone={settings?.timeZone??"America/Fortaleza"}/></ProfessorShell>
}
