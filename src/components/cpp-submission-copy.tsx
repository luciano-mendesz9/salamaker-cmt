"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function CppSubmissionCopy({ code, prompt, maxXp }: { code: string; prompt: string; maxXp: number }) {
  const [feedback, setFeedback] = useState("");
  const correctionPrompt = `Na aula de robotica, propus aos alunos uma atividade de codificação para um circuito arduino que forneci a eles. Essa atividade vale até ${maxXp}XP. Sendo criteriozo, analise o código e enunciado abaixo e me diga quanto você daria de XP para esse aluno. Al´em disso, se o aluno não receber a pontuação máxima, me entregue um parágrafo breve e objetivo justificando a pontuação:\n\nEnunciado da questão: ${prompt}\nCódigo do Aluno: ${code}\n\n`;

  async function copy(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(successMessage);
    } catch {
      setFeedback("Não foi possível copiar. Verifique a permissão da área de transferência.");
    }
  }

  return <>
    <button type="button" className="button-secondary mt-4 inline-flex items-center gap-2" onClick={() => copy(code, "Código copiado.")}><Copy size={16}/>Copiar código</button>
    <pre className="mt-4 overflow-x-auto whitespace-pre rounded-xl bg-[#07140f] p-4 font-mono text-sm leading-6 text-emerald-100">{code}</pre>
    <button type="button" className="button-secondary mt-4 inline-flex items-center gap-2" onClick={() => copy(correctionPrompt, "Prompt para correção copiado.")}><Copy size={16}/>Copiar prompt para correção</button>
    {feedback && <p role="status" className="mt-2 text-sm text-emerald-200">{feedback}</p>}
  </>;
}
