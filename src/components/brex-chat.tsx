"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, ChevronRight, Menu, MessageCircle, Plus, RotateCcw, Send, Sparkles, Trash2, X } from "lucide-react";
import brexAvatar from "@/assets/brex-ai.png";
import brexDisabled from "@/assets/brex-ai-disabled.png";
import { BrexMarkdown } from "@/components/brex-markdown";
import styles from "./brex-chat.module.css";

type ChatSummary = { id: string; title: string; updatedAt: string };
type ChatMessage = { id: string; role: "STUDENT" | "ASSISTANT"; content: string; createdAt: string };
type Quota = { limit: number; used: number; remaining: number; refreshAt: string | null; checkedAt: string };
const greeting = (name: string) => `Olá, ${name}! Eu sou o Brex AI, o agente de inteligência artificial desenvolvido pelo professor Luciano com Llama 3 como base. Ainda estou em fase de testes e ajustes, então tenha um pouquinho de paciência comigo. 😄 Como posso ajudar você?`;

export function BrexChat({ firstName }: { firstName: string }) {
  const [state, setState] = useState<"checking" | "active" | "inactive">("checking");
  const [version, setVersion] = useState("0.1.0");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [greetingLength, setGreetingLength] = useState(0);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [typingLength, setTypingLength] = useState(0);
  const [lastTokens, setLastTokens] = useState<number | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [now, setNow] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);

  const check = useCallback(async () => {
    setState("checking"); setError(""); setGreetingLength(0);
    try {
      const [pingResponse, chatsResponse] = await Promise.all([fetch("/api/student/brex-ai/ping", { cache: "no-store" }), fetch("/api/student/brex-ai", { cache: "no-store" })]);
      const ping = await pingResponse.json();
      if (ping.quota) { const offset = Date.parse(ping.quota.checkedAt) - Date.now(); setClockOffset(offset); setNow(Date.now() + offset); setQuota(ping.quota); }
      if (!pingResponse.ok || !ping.active) { setVersion(ping.version ?? "0.1.0"); setState("inactive"); return; }
      setVersion(ping.version ?? "0.1.0");
      if (chatsResponse.ok) setChats((await chatsResponse.json()).chats);
      setState("active");
    } catch { setState("inactive"); }
  }, []);
  useEffect(() => { queueMicrotask(() => void check()); }, [check]);
  useEffect(() => {
    if (state !== "checking") return;
    const timer = window.setInterval(() => setGreetingLength(value => Math.min(greeting(firstName).length, value + 2)), 25);
    return () => window.clearInterval(timer);
  }, [firstName, state]);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (!quota?.refreshAt) return;
    const refreshIn = Math.max(0, new Date(quota.refreshAt).getTime() - Date.now() - clockOffset);
    const ticker = window.setInterval(() => setNow(Date.now() + clockOffset), 1000);
    const refresh = window.setTimeout(() => void check(), refreshIn + 1000);
    return () => { window.clearInterval(ticker); window.clearTimeout(refresh); };
  }, [quota?.refreshAt, clockOffset, check]);
  useEffect(() => {
    if (!typingId) return;
    const message = messages.find(item => item.id === typingId);
    if (!message) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { queueMicrotask(() => setTypingLength(message.content.length)); return; }
    const timer = window.setInterval(() => setTypingLength(value => {
      const next = Math.min(message.content.length, value + 5);
      if (next === message.content.length) window.clearInterval(timer);
      return next;
    }), 16);
    return () => window.clearInterval(timer);
  }, [typingId, messages]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typingLength, busy]);

  async function openChat(id: string) {
    if (busy) return;
    setError(""); setMenuOpen(false);
    try {
      const response = await fetch(`/api/student/brex-ai/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível abrir essa conversa.");
      const chat = await response.json(); setChatId(id); setMessages(chat.messages); setTypingId(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível abrir essa conversa."); }
  }
  function newChat() { if (busy) return; setChatId(null); setMessages([]); setDraft(""); setError(""); setTypingId(null); setMenuOpen(false); }
  async function deleteChat(id: string) {
    if (busy || !window.confirm("Excluir esta conversa e suas mensagens?")) return;
    const response = await fetch(`/api/student/brex-ai/${id}`, { method: "DELETE" });
    if (response.ok) { setChats(current => current.filter(item => item.id !== id)); if (chatId === id) newChat(); }
    else setError("Não foi possível excluir a conversa.");
  }
  async function send(event: React.FormEvent) {
    event.preventDefault(); const query = draft.trim(); if (!query || query.length > 300 || busy || !quota || quota.remaining === 0) return;
    const tempId = `temp-${Date.now()}`; setDraft(""); setError(""); setBusy(true); setSeconds(0); setTypingId(null);
    setMessages(current => [...current, { id: tempId, role: "STUDENT", content: query, createdAt: new Date().toISOString() }]);
    try {
      const response = await fetch("/api/student/brex-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, chatId }) });
      const result = await response.json();
      if (result.quota) { const offset = Date.parse(result.quota.checkedAt) - Date.now(); setClockOffset(offset); setNow(Date.now() + offset); setQuota(result.quota); }
      if (!response.ok) throw new Error(result.message || "Brex não conseguiu responder agora.");
      setChatId(result.chatId); setLastTokens(result.usage.chargedTokens);
      setChats(current => [{ id: result.chatId, title: result.title, updatedAt: result.createdAt }, ...current.filter(item => item.id !== result.chatId)]);
      setMessages(current => [...current, { id: result.messageId, role: "ASSISTANT", content: result.answer, createdAt: result.createdAt }]);
      setTypingLength(0); setTypingId(result.messageId);
    } catch (failure) {
      setMessages(current => current.filter(item => item.id !== tempId)); setDraft(query);
      setError(failure instanceof Error ? failure.message : "Brex não conseguiu responder agora.");
    } finally { setBusy(false); }
  }
  const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  const cooldownSeconds = quota?.refreshAt ? Math.max(0, Math.ceil((new Date(quota.refreshAt).getTime() - now) / 1000)) : 0;
  const cooldown = `${Math.floor(cooldownSeconds / 60)}m ${String(cooldownSeconds % 60).padStart(2, "0")}s`;

  if (state === "inactive") return <main className={styles.disabled}><Image src={brexDisabled} alt="Brex AI desativado" className={styles.disabledAvatar} priority/><h1>Ops, Brex está desativado.</h1><p>Espere o professor reativá-lo em aula.</p><div className={styles.disabledActions}><Link href="/aluno"><ArrowLeft size={17}/>Voltar</Link><button onClick={() => void check()}><RotateCcw size={17}/>Tentar novamente</button></div></main>;

  return <main className={styles.shell}>
    <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`} aria-label="Histórico de conversas">
      <div className={styles.sideTop}><Link href="/aluno" className={styles.back}><ArrowLeft size={18}/>Sala Maker</Link><button className={styles.mobileClose} onClick={() => setMenuOpen(false)} aria-label="Fechar histórico"><X size={20}/></button></div>
      <div className={styles.sideBrand}><span className={styles.brandAvatar}><Image src={brexAvatar} alt="" fill sizes="48px"/></span><span><strong>Brex AI</strong><small>Seu parceiro maker</small></span></div>
      <button className={styles.newChat} onClick={newChat} disabled={busy}><Plus size={18}/>Nova conversa</button>
      <div className={styles.history}><p className={styles.historyLabel}>CONVERSAS RECENTES</p>{chats.length === 0 ? <p className={styles.emptyHistory}>Suas conversas aparecerão aqui.</p> : chats.map(chat => <div className={`${styles.chatRow} ${chatId === chat.id ? styles.chatRowActive : ""}`} key={chat.id}><button onClick={() => void openChat(chat.id)} disabled={busy}><MessageCircle size={16}/><span>{chat.title}</span></button><button className={styles.delete} aria-label={`Excluir conversa ${chat.title}`} onClick={() => void deleteChat(chat.id)} disabled={busy}><Trash2 size={15}/></button></div>)}</div>
      <div className={styles.sideFooter}><Sparkles size={15}/> Brex AI · versão {version}</div>
    </aside>
    {menuOpen && <button className={styles.overlay} onClick={() => setMenuOpen(false)} aria-label="Fechar histórico"/>}
    <section className={styles.mainArea}>
      <header className={styles.topbar}><button className={styles.menu} onClick={() => setMenuOpen(true)} aria-label="Abrir histórico"><Menu size={21}/></button><div className={styles.topTitle}><span className={styles.onlineDot}/>Brex AI <small>v{version}</small></div><span className={styles.tokens}><Sparkles size={15}/>{quota ? `${quota.remaining.toLocaleString("pt-BR")} / ${quota.limit.toLocaleString("pt-BR")} tokens` : "Carregando saldo..."}</span></header>
      <div className={styles.scrollArea}>
        {messages.length === 0 ? <div className={styles.welcome}><div className={styles.heroAvatar}><Image src={brexAvatar} alt="Brex AI" fill sizes="112px" priority/></div><p className={styles.eyebrow}>SEU ASSISTENTE MAKER</p><h1>Olá, {firstName}<span>!</span></h1><div className={styles.greeting}>{state === "checking" ? greeting(firstName).slice(0, greetingLength) : greeting(firstName)}{state === "checking" && <span className={styles.caret}>▍</span>}</div><div className={styles.suggestions}><span>Programação</span><span>Arduino</span><span>Robótica</span></div></div> : <div className={styles.messageList}>{messages.map(message => <article className={`${styles.message} ${message.role === "STUDENT" ? styles.fromStudent : styles.fromBrex}`} key={message.id}>{message.role === "ASSISTANT" && <span className={styles.messageAvatar}><Image src={brexAvatar} alt="Brex AI" fill sizes="38px"/></span>}<div className={styles.messageBody}><div className={styles.bubble}><BrexMarkdown content={message.id === typingId ? message.content.slice(0, typingLength) : message.content}/>{message.id === typingId && typingLength < message.content.length && <span className={styles.caret}>▍</span>}</div><time dateTime={message.createdAt}>{message.role === "ASSISTANT" ? "Brex AI · " : "Você · "}{time(message.createdAt)}</time></div></article>)}{busy && <div className={styles.processing}><span className={styles.messageAvatar}><Image src={brexAvatar} alt="" fill sizes="38px"/></span><div><div className={styles.orb}/><span>Processando por {seconds >= 60 ? `${Math.floor(seconds / 60)}m ` : ""}{seconds % 60}s...</span></div></div>}<div ref={bottom}/></div>}
      </div>
      {state === "active" && <div className={styles.composerWrap}>{quota?.remaining === 0 && <p className={styles.quotaNotice} role="status">Seus tokens acabaram. Eles voltam em {cooldown}.</p>}{error && quota?.remaining !== 0 && <p className={styles.error} role="alert">{error}</p>}<form onSubmit={send} className={styles.composer}><label htmlFor="brex-query" className="sr-only">Sua mensagem para o Brex AI</label><textarea id="brex-query" value={draft} onChange={event => setDraft(event.target.value.slice(0, 300))} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={300} rows={2} disabled={busy || !quota || quota.remaining === 0} placeholder={quota?.remaining === 0 ? "Aguarde a renovação dos seus tokens..." : "Pergunte sobre programação, Arduino ou robótica..."}/><div className={styles.composerBottom}><span>{draft.length}/300 caracteres · {lastTokens === null ? `Saldo: ${quota?.remaining.toLocaleString("pt-BR") ?? "..."} tokens` : `Último débito: ${lastTokens.toLocaleString("pt-BR")} tokens · saldo: ${quota?.remaining.toLocaleString("pt-BR") ?? "..."}`}</span><button type="submit" disabled={!draft.trim() || busy || !quota || quota.remaining === 0} aria-label="Enviar mensagem"><Send size={19}/></button></div></form><p className={styles.note}><Bot size={13}/>Brex pode errar. Confirme informações importantes com o professor Luciano. <ChevronRight size={13}/></p></div>}
    </section>
  </main>;
}
