import { Atom, BookOpen, UsersRound, Zap } from "lucide-react";
import { ProfessorShell } from "@/components/professor-shell";
import { StudentManager, type StudentRow } from "@/components/student-manager";
import { LessonControl } from "@/components/lesson-control";
import { prisma } from "@/lib/db";

export default async function Professor(){
  const[students,lessonCount,openLesson]=await Promise.all([
    prisma.user.findMany({where:{role:"STUDENT"},select:{id:true,firstName:true,lastName:true,accessCode:true,originSchoolClass:true,status:true,xp:true,devCoins:true,mustChangePassword:true,createdAt:true,updatedAt:true,lastLoginAt:true,lastSeenAt:true},orderBy:[{status:"asc"},{firstName:"asc"}]}),
    prisma.lesson.count({where:{status:"CLOSED"}}),
    prisma.lesson.findFirst({where:{status:"OPEN"},include:{attendances:{select:{studentId:true,status:true}},participants:{include:{student:{select:{id:true,firstName:true,lastName:true,originSchoolClass:true}}},orderBy:{student:{firstName:"asc"}}}}}),
  ]);
  const rows:StudentRow[]=students.map(({originSchoolClass,...student})=>({...student,schoolClass:originSchoolClass,createdAt:student.createdAt.toISOString(),updatedAt:student.updatedAt.toISOString(),lastLoginAt:student.lastLoginAt?.toISOString()??null,lastSeenAt:student.lastSeenAt?.toISOString()??null}));
  const active=students.filter(student=>student.status==="ACTIVE");
  const participants=openLesson?openLesson.participants.map(participant=>participant.student):[];
  const lesson=openLesson?{id:openLesson.id,title:openLesson.title,openedAt:openLesson.openedAt.toISOString(),attendances:openLesson.attendances}:null;
  return <ProfessorShell title="Visão geral"><section className="relative overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-r from-[#142b4c] via-[#10223b] to-[#101b2f] p-6 sm:p-9"><Atom className="absolute right-12 top-3 hidden text-blue-300/10 md:block" size={190}/><div className="relative"><p className="eyebrow">Turma de Robótica / visão geral</p><h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Sua Sala Maker, <span className="text-blue-300">em movimento.</span></h2><p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">Abra a aula para toda a turma, acompanhe presenças e revise o fechamento antes de aplicar XP.</p><LessonControl initialLesson={lesson} initialStudents={participants}/></div></section><section className="mt-6 grid gap-4 sm:grid-cols-3"><Stat icon={UsersRound} label="Alunos ativos" value={String(active.length)} note="na única turma de Robótica"/><Stat icon={BookOpen} label="Aulas realizadas" value={String(lessonCount)} note="aulas fechadas"/><Stat icon={Zap} label="XP distribuído" value={String(students.reduce((total,student)=>total+student.xp,0))} note="saldo total"/></section><StudentManager initialStudents={rows}/></ProfessorShell>;
}
function Stat({icon:Icon,label,value,note}:{icon:typeof UsersRound;label:string;value:string;note:string}){return <div className="glass flex items-start justify-between rounded-2xl p-5"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p><p className="mt-2 text-xs text-blue-300">{note}</p></div><span className="rounded-xl bg-blue-400/10 p-3 text-blue-300"><Icon/></span></div>}
