import { NextResponse } from "next/server";
import { chatThreads } from "../../../../data/chat";
import { createSupabaseServiceClient, getAuthenticatedUser } from "../../../../lib/supabase/server";
import type { ChatMessage, ChatThread } from "../../../../types/analytics";

type ThreadRecord = {
  id: string;
  title: string;
  updated_at: string;
};

type MessageRecord = {
  id: string;
  thread_id: string;
  role: "user" | "agent";
  content: string;
  created_at: string;
};

export async function GET() {
  const user = await getAuthenticatedUser();
  const supabase = createSupabaseServiceClient();

  if (!supabase || !user) return NextResponse.json({ threads: chatThreads, source: "demo" });

  const { data: threads, error: threadError } = await supabase
    .from("chat_threads")
    .select("id,title,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20)
    .returns<ThreadRecord[]>();

  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });
  if (!threads?.length) return NextResponse.json({ threads: chatThreads, source: "demo" });

  const threadIds = threads.map((thread) => thread.id);
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id,thread_id,role,content,created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: true })
    .returns<MessageRecord[]>();

  const messagesByThread = new Map<string, ChatMessage[]>();
  for (const message of messages ?? []) {
    const list = messagesByThread.get(message.thread_id) ?? [];
    list.push({
      id: message.id,
      role: message.role,
      text: message.content,
      createdAt: message.created_at,
    });
    messagesByThread.set(message.thread_id, list);
  }

  const payload: ChatThread[] = threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updated: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(thread.updated_at)),
    messages: messagesByThread.get(thread.id) ?? [],
  }));

  return NextResponse.json({ threads: payload, source: "live" });
}
