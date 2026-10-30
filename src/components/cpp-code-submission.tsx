"use client";
/* eslint-disable @next/next/no-img-element -- The Cloudinary circuit image needs its original pixels for zoom. */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import styles from "./cpp-code-submission.module.css";

const STARTER = "void setup() {\n  \n}\n\nvoid loop() {\n  \n}\n";
const COMPLETIONS = ["#define", "#include", "analogRead", "analogWrite", "attachInterrupt", "constrain", "digitalRead", "digitalWrite", "delayMicroseconds", "detachInterrupt", "INPUT_PULLUP", "millis", "pinMode", "randomSeed", "Serial.available", "Serial.begin", "Serial.print", "Serial.println", "Serial.read", "sizeof", "tone", "unsigned", "while"];
const KEYWORDS = new Set(["auto", "bool", "break", "case", "char", "class", "const", "continue", "default", "do", "double", "else", "enum", "false", "float", "for", "if", "int", "long", "namespace", "nullptr", "private", "public", "return", "short", "signed", "static", "struct", "switch", "true", "unsigned", "using", "void", "volatile", "while"]);
const ARDUINO = new Set(["analogRead", "analogWrite", "attachInterrupt", "constrain", "delay", "delayMicroseconds", "detachInterrupt", "digitalRead", "digitalWrite", "HIGH", "highByte", "INPUT", "INPUT_PULLUP", "LOW", "lowByte", "map", "millis", "micros", "noTone", "OUTPUT", "pinMode", "pulseIn", "random", "randomSeed", "Serial", "Serial.available", "Serial.begin", "Serial.print", "Serial.println", "Serial.read", "tone"]);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[a-zA-Z_]+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)?|[+\-*/%=!<>|&^~?:]+)/g;

function highlighted(code: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index;
    if (index > last) parts.push(code.slice(last, index));
    const value = match[0];
    const kind = value.startsWith("//") || value.startsWith("/*") ? "comment" : value === "#define" ? "define" : value === "#include" ? "include" : value.startsWith("#") ? "directive" : value.startsWith('"') || value.startsWith("'") ? "string" : /^\d/.test(value) ? "number" : ARDUINO.has(value) ? "arduino" : KEYWORDS.has(value) ? "keyword" : /^[+\-*/%=!<>|&^~?:]+$/.test(value) ? "operator" : "";
    parts.push(kind ? <span key={index} className={styles[kind]}>{value}</span> : value);
    last = index + value.length;
  }
  parts.push(code.slice(last));
  return parts;
}

export function CppCodeSubmission({ activityId, questionId, prompt, imageUrl }: { activityId: string; questionId: string; prompt: string; imageUrl: string | null }) {
  const router = useRouter();
  const editor = useRef<HTMLTextAreaElement>(null);
  const highlight = useRef<HTMLPreElement>(null);
  const lines = useRef<HTMLDivElement>(null);
  const seconds = useRef(0);
  const lastTyping = useRef(0);
  const [code, setCode] = useState(STARTER);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [imageOpen, setImageOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const storageKey = `cpp-activity:${activityId}`;

  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (stored && typeof stored.code === "string" && typeof stored.seconds === "number") {
        seconds.current = Math.max(0, stored.seconds);
        queueMicrotask(() => { if (alive) setCode(stored.code); });
      }
    } catch { /* A draft is optional. */ }
    let alive = true;
    fetch(`/api/student/activities/${activityId}/code-start`, { method: "POST" })
      .then(async response => { if (!response.ok) throw new Error((await response.json()).message || "Não foi possível iniciar a edição."); if (alive) setReady(true); })
      .catch(error => { if (alive) setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a edição."); });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.activeElement === editor.current && performance.now() - lastTyping.current < 30_000) {
        seconds.current += 1;
        try { sessionStorage.setItem(storageKey, JSON.stringify({ code: editor.current?.value ?? STARTER, seconds: seconds.current })); } catch { /* Storage may be unavailable. */ }
      }
    }, 1000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [activityId, storageKey]);

  function persist(next: string) {
    setCode(next);
    lastTyping.current = performance.now();
    try { sessionStorage.setItem(storageKey, JSON.stringify({ code: next, seconds: seconds.current })); } catch { /* Storage may be unavailable. */ }
    const cursor = editor.current?.selectionStart ?? next.length;
    const word = /[a-zA-Z_][\w.]*$/.exec(next.slice(0, cursor))?.[0] ?? "";
    setSuggestions(word.length >= 5 ? COMPLETIONS.filter(item => item.toLowerCase().startsWith(word.toLowerCase()) && item !== word).slice(0, 5) : []);
  }

  function onChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const input = event.nativeEvent as InputEvent;
    const next = event.currentTarget.value;
    const cursor = event.currentTarget.selectionStart;
    const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")", '"': '"', "'": "'" };
    if (!input.isComposing && input.inputType === "insertText" && input.data && pairs[input.data] && next.length === code.length + 1 && next[cursor - 1] === input.data) {
      insert(next.slice(0, cursor) + pairs[input.data] + next.slice(cursor), cursor);
    } else persist(next);
  }

  function insert(next: string, cursor: number) {
    persist(next);
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(cursor, cursor); });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const element = event.currentTarget;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const before = code.slice(0, start);
    const after = code.slice(end);
    if ((event.ctrlKey || event.metaKey) && ["c", "x", "v"].includes(event.key.toLowerCase())) { event.preventDefault(); return; }
    if (event.key === "Tab") { event.preventDefault(); insert(before + "  " + after, start + 2); return; }
    if (event.key === "}" && start === end && code[start] !== "}" && /^\s+$/.test(before.slice(before.lastIndexOf("\n") + 1))) {
      event.preventDefault();
      const currentLine = before.slice(before.lastIndexOf("\n") + 1);
      const remove = Math.min(2, currentLine.length);
      insert(before.slice(0, -remove) + "}" + after, start - remove + 1);
      return;
    }
    if (event.key === "Enter" && suggestions.length) { event.preventDefault(); chooseSuggestion(suggestions[0]); return; }
    if (event.key === "Enter") {
      event.preventDefault();
      const line = before.slice(before.lastIndexOf("\n") + 1);
      const indent = /^\s*/.exec(line)?.[0] ?? "";
      const opensBlock = /\{\s*$/.test(line);
      const middle = "\n" + indent + (opensBlock ? "  " : "");
      const closesBlock = opensBlock && after.startsWith("}");
      insert(before + middle + (closesBlock ? "\n" + indent : "") + after, start + middle.length);
      return;
    }
    const pairs: Record<string, string> = { "{": "}", "[": "]", "(": ")", '"': '"', "'": "'" };
    if (!event.ctrlKey && !event.metaKey && pairs[event.key]) {
      event.preventDefault();
      const selected = code.slice(start, end);
      const closing = pairs[event.key];
      persist(before + event.key + selected + closing + after);
      requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + 1, end > start ? end + 1 : start + 1); });
      return;
    }
    if (start === end && ["}", "]", ")", '"', "'"].includes(event.key) && code[start] === event.key) { event.preventDefault(); element.setSelectionRange(start + 1, start + 1); }
  }

  function chooseSuggestion(value: string) {
    const element = editor.current;
    if (!element) return;
    const cursor = element.selectionStart;
    const before = code.slice(0, cursor);
    const word = /[a-zA-Z_][\w.]*$/.exec(before)?.[0] ?? "";
    insert(before.slice(0, -word.length) + value + code.slice(element.selectionEnd), cursor - word.length + value.length);
    setSuggestions([]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || !code.trim() || !confirm("Enviar o código C++? O envio é único e não poderá ser alterado.")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/student/activities/${activityId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: [{ questionId, writtenText: code }], codingSeconds: seconds.current }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Não foi possível enviar o código.");
      sessionStorage.removeItem(storageKey);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  const lineCount = code.split("\n").length;
  return <>
    <div className={styles.layout}>
      <section className={styles.instructions} aria-label="Enunciado do desafio"><p className={styles.kicker}>Desafio de programação</p><h2>Enunciado</h2><p className={styles.prompt}>{prompt}</p>
        {imageUrl && <button type="button" className={styles.imageButton} onClick={() => { setZoom(1); setImageOpen(true); }} aria-label="Ampliar imagem do circuito"><img src={imageUrl} alt="Imagem de referência do circuito"/><span><Maximize2 size={16}/> Abrir imagem e ampliar</span></button>}
      </section>
      <form onSubmit={submit} className={styles.workbench}>
        <div className={styles.toolbar}><div><span className={styles.dot}/><span className={styles.dot}/><span className={styles.dot}/><strong>codigo.ino</strong></div><span>C++ / Arduino</span></div>
        <p className={styles.tip}>Digite seu código. Tab insere dois espaços. Sugestões aparecem após 5 caracteres.</p>
        <div className={styles.editor}>
          <div ref={lines} className={styles.lines} aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <div key={index}>{index + 1}</div>)}</div>
          <div className={styles.codeArea}>
            <pre ref={highlight} className={styles.highlight} aria-hidden="true">{highlighted(code)}{"\n"}</pre>
            <textarea ref={editor} className={styles.textarea} aria-label="Editor de código C++" value={code} onChange={onChange} onKeyDown={onKeyDown} onScroll={event => { if (highlight.current) { highlight.current.scrollTop = event.currentTarget.scrollTop; highlight.current.scrollLeft = event.currentTarget.scrollLeft; } if (lines.current) lines.current.scrollTop = event.currentTarget.scrollTop; }} onCopy={event => event.preventDefault()} onCut={event => event.preventDefault()} onPaste={event => event.preventDefault()} onDrop={event => event.preventDefault()} onBeforeInput={event => { if ((event.nativeEvent as InputEvent).inputType?.includes("Paste")) event.preventDefault(); }} spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" disabled={!ready || busy} maxLength={50000} wrap="off"/>
          </div>
        </div>
        {suggestions.length > 0 && <div className={styles.suggestions} role="listbox" aria-label="Sugestões de código">{suggestions.map(item => <button key={item} type="button" role="option" aria-selected={false} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(item)}>{item}</button>)}</div>}
        <div className={styles.footer}><p>O código será avaliado manualmente pelo professor.</p><button className="button-primary" disabled={!ready || busy || !code.trim()}>{busy ? "Enviando…" : "Enviar código"}</button></div>
        {message && <p role="alert" className={styles.message}>{message}</p>}
      </form>
    </div>
    {imageOpen && imageUrl && <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Imagem do circuito ampliada" onClick={() => setImageOpen(false)} onKeyDown={event => { if (event.key === "Escape") setImageOpen(false); }}><div className={styles.modalBar} onClick={event => event.stopPropagation()}><button type="button" onClick={() => setZoom(value => Math.max(1, value - 0.25))} aria-label="Reduzir zoom"><Minus size={20}/></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom(value => Math.min(4, value + 0.25))} aria-label="Aumentar zoom"><Plus size={20}/></button><button type="button" onClick={() => setImageOpen(false)} aria-label="Fechar imagem"><X size={22}/></button></div><div className={styles.imageViewport} onClick={event => event.stopPropagation()}><img src={imageUrl} alt="Imagem de referência do circuito ampliada" style={{ width: `${zoom * 100}%` }}/></div></div>}
  </>;
}
