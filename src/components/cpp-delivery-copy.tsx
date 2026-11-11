"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CppDeliveryCopy({ code }: { code: string }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  }

  return <section className="student-card mt-6 rounded-2xl p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow">Código Arduino/C++</p><h2 className="mt-2 font-display text-xl font-bold">Código para copiar</h2></div>
      <button type="button" onClick={copy} className="button-primary focus-ring min-h-11"><Copy size={17}/>Copiar código</button>
    </div>
    {feedback&&<p role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm font-semibold text-[var(--accent-soft)]">{feedback==="copied"?<><Check size={17}/>Código copiado.</>:"Não foi possível copiar o código. Verifique a permissão da área de transferência."}</p>}
    <pre className="mt-5 overflow-x-auto whitespace-pre rounded-xl border border-[var(--line)] bg-[var(--field)] p-4 font-mono text-sm leading-6 text-[var(--text)] sm:p-5"><code>{code}</code></pre>
  </section>;
}
