"use client";

import { motion } from "framer-motion";
import { MessageSquareText, Plus, SendHorizontal } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import type { ChatMessage, ChatThread } from "../types/analytics";

const NEW_THREAD_ID = "new";

export default function GrowthAdvisor({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>(NEW_THREAD_ID);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadThreads() {
      const response = await fetch("/api/chat/threads");
      if (!response.ok) return;
      const payload = (await response.json()) as { threads?: ChatThread[] };
      if (!payload.threads?.length) return;
      setThreads(payload.threads);
      setActiveThreadId(payload.threads[0].id);
      setMessages(payload.threads[0].messages);
    }

    void loadThreads();
  }, [isAuthenticated]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;

    setDraft("");
    setIsSending(true);
    const optimisticMessages: ChatMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", text: question },
    ];
    setMessages(optimisticMessages);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: activeThreadId, message: question }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { threadId?: string; messages?: ChatMessage[] };
      if (payload.threadId) setActiveThreadId(payload.threadId);
      if (payload.messages) setMessages(payload.messages);
      await refreshThreads();
    } else {
      setMessages([
        ...optimisticMessages,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: "I could not reach the advisor endpoint. Check the database and OpenAI env setup, then try again.",
        },
      ]);
    }

    setIsSending(false);
  }

  async function refreshThreads() {
    if (!isAuthenticated) return;
    const response = await fetch("/api/chat/threads");
    if (!response.ok) return;
    const payload = (await response.json()) as { threads?: ChatThread[] };
    if (payload.threads?.length) setThreads(payload.threads);
  }

  function selectThread(thread: ChatThread) {
    setActiveThreadId(thread.id);
    setMessages(thread.messages);
    setDraft("");
  }

  function startNewChat() {
    setActiveThreadId(NEW_THREAD_ID);
    setMessages([]);
    setDraft("");
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const isEmptyThread = messages.length === 0;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="chat-shell"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <aside className="chat-history" aria-label="Chat history">
        <div className="chat-history-header">
          <span>History</span>
          <button onClick={startNewChat} type="button" aria-label="Start new chat">
            <Plus size={14} />
          </button>
        </div>

        <div className="chat-history-list">
          {threads.length === 0 ? (
            <p className="chat-history-empty">No conversations yet.</p>
          ) : (
            threads.map((thread) => (
              <button
                className={activeThreadId === thread.id ? "chat-history-item is-active" : "chat-history-item"}
                key={thread.id}
                onClick={() => selectThread(thread)}
                type="button"
              >
                <strong>{thread.title}</strong>
                <span>{thread.updated}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section aria-label="Growth advisor chat" className="advisor-minimal">
        <div className="chat-thread" aria-live="polite" aria-label="Conversation with growth advisor">
          {isEmptyThread ? (
            <div className="chat-empty" role="status">
              <span className="chat-empty-icon" aria-hidden="true">
                <MessageSquareText size={22} />
              </span>
              <strong>Ask your data what to do next</strong>
              <small>Try: &ldquo;What is working this week?&rdquo; or &ldquo;Where is my audience coming from?&rdquo;</small>
            </div>
          ) : (
            messages.map((message) => (
              <article className={message.role === "agent" ? "chat-message is-agent" : "chat-message is-user"} key={message.id}>
                <p>{message.text}</p>
              </article>
            ))
          )}
        </div>

        <form className="chat-composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="advisor-question">Ask the growth advisor</label>
          <textarea
            id="advisor-question"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask about growth, content, or next moves"
            rows={1}
            value={draft}
          />
          <button className="primary-button" type="submit" disabled={isSending}>
            <SendHorizontal size={16} />
            <span>{isSending ? "Sending" : "Send"}</span>
          </button>
        </form>
      </section>
    </motion.div>
  );
}
