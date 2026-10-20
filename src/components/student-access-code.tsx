"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function StudentAccessCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Código de matrícula copiado.");
    setTimeout(() => setCopied(false), 2_000);
  }
  return <span className="flex items-center gap-3"><strong className="font-mono text-base tracking-wider">{value}</strong><button type="button" onClick={copy} className="student-icon-button !h-9 !w-9" aria-label="Copiar código de matrícula">{copied ? <Check size={16}/> : <Copy size={16}/>}</button></span>;
}
