import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, UsersRound } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { ExternalActivityActions, FormSubmission } from "@/components/student-activity-actions";
import { activityStateLabel, effectiveActivityState, formatSchoolDate } from "@/lib/activities";
import { requireStudent } from "@/lib/authorization";
import { prisma } from "@/lib/db";

export default async function StudentActivity({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;
  const [recipient, settings] = await Promise.all([
    prisma.activityRecipient.findUnique({
      where: { activityId_studentId: { activityId: id, studentId: student.id } },
      include: {
        activity: {
          include: {
            questions: {
              select: {
                id: true, prompt: true, type: true, maxXp: true, position: true,
                options: { select: { id: true, text: true, position: true }, orderBy: { position: "asc" } },
              },
              orderBy: { position: "asc" },
            },
          },
        },
        submission: {
          include: {
            answers: {
              include: {
                question: { select: { id: true, prompt: true, type: true, maxXp: true, position: true } },
                selections: { include: { option: { select: { id: true, text: true, isCorrect: true } } } },
              },
            },
          },
        },
        award: true,
        teamMembership: { include: { team: { include: { members: { include: { student: { select: { firstName: true, lastName: true } } } } } } } },
      },
    }),
    prisma.appSetting.findUnique({ where: { id: 1 }, select: { timeZone: true } }),
  ]);
  if (!recipient) notFound();
  const activity = recipient.activity;
  const state = effectiveActivityState(activity);
  const closed = state === "CLOSED";
  const timeZone = settings?.timeZone ?? "America/Fortaleza";
  return <main className="mesh min-h-screen pb-10"><div className="mx-auto max-w-4xl px-4 sm:px-8">
    <header className="flex h-20 items-center justify-between border-b border-white/7"><Brand context="Estudante"/><LogoutButton/></header>
    <Link href="/aluno/atividades" className="mt-6 inline-flex items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16}/>Todas as atividades</Link>
    <section className="glass mt-6 rounded-3xl p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">{activityStateLabel[state]}</p><h1 className="mt-3 font-display text-3xl font-bold">{activity.title}</h1></div><span className="rounded-full bg-blue-400/10 px-3 py-1 text-sm font-bold text-blue-300">{activity.maxXp} XP</span></div>{activity.description&&<p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{activity.description}</p>}<div className="mt-5 flex items-center gap-2 text-sm text-slate-400"><Clock3 size={16}/>De {formatSchoolDate(activity.opensAt,timeZone)} até {formatSchoolDate(activity.closesAt,timeZone)}</div></section>
    {state==="SCHEDULED"&&<Notice text="Esta atividade ainda não abriu."/>}
    {activity.type==="EXTERNAL_LINK"&&activity.externalUrl&&state==="OPEN"&&<ExternalActivityActions activityId={id} url={activity.externalUrl} signaled={Boolean(recipient.studentSignaledAt)}/>} 
    {activity.type==="GROUP"&&<section className="glass mt-6 rounded-2xl p-5"><h2 className="flex items-center gap-2 font-display text-xl font-bold"><UsersRound size={20}/>Minha equipe</h2>{recipient.teamMembership?<><p className="mt-4 font-bold">{recipient.teamMembership.team.name}</p><ul className="mt-3 space-y-2 text-sm text-slate-300">{recipient.teamMembership.team.members.map(member=><li key={member.id}>{member.student.firstName} {member.student.lastName}</li>)}</ul><p className="mt-4 text-sm text-slate-400">{recipient.award?`Concluída · ${recipient.award.awardedXp} XP recebidos.`:"A equipe aguarda confirmação do professor."}</p></>:<p className="mt-3 text-sm text-slate-400">Equipe não encontrada.</p>}</section>}
    {activity.type==="FORM"&&!recipient.submission&&state==="OPEN"&&<FormSubmission activityId={id} questions={activity.questions}/>} 
    {activity.type==="FORM"&&recipient.submission&&<section className="mt-6"><Notice text={recipient.submission.status==="AWAITING_REVIEW"?"Respostas enviadas. Aguardando a correção das questões escritas.":`Atividade corrigida: ${recipient.award?.awardedXp??0} XP.`}/><div className="mt-4 space-y-3">{recipient.submission.answers.sort((a,b)=>a.question.position-b.question.position).map((answer,index)=><article key={answer.id} className="glass rounded-2xl p-5"><h3 className="font-bold">{index+1}. {answer.question.prompt}</h3>{answer.writtenText?<p className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-950/30 p-3 text-sm">{answer.writtenText}</p>:<ul className="mt-3 space-y-2">{answer.selections.map(selection=><li key={selection.option.id} className="rounded-lg bg-blue-400/10 p-3 text-sm">{selection.option.text}{closed&&<span className={selection.option.isCorrect?"ml-2 text-emerald-300":"ml-2 text-rose-300"}>{selection.option.isCorrect?"· correta":"· incorreta"}</span>}</li>)}</ul>}{answer.awardedXp!==null&&<p className="mt-3 flex items-center gap-2 text-sm font-bold text-blue-300"><CheckCircle2 size={16}/>{answer.awardedXp} de {answer.question.maxXp} XP</p>}{answer.comment&&<p className="mt-2 text-sm text-slate-400">Feedback: {answer.comment}</p>}</article>)}</div></section>}
    {closed&&!recipient.submission&&activity.type==="FORM"&&<Notice text="O prazo terminou sem envio."/>}
  </div></main>;
}
function Notice({text}:{text:string}){return <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/8 p-4 text-sm text-blue-100">{text}</div>}
