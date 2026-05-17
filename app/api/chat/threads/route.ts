import { NextResponse } from "next/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { chatThreads } from "../../../../data/chat";
import { db } from "../../../../db";
import { chatMessages, chatThreads as chatThreadTable } from "../../../../db/schema";
import { getCurrentUser } from "../../../../lib/current-user";
import type { ChatMessage, ChatThread } from "../../../../types/analytics";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) return NextResponse.json({ threads: chatThreads, source: "demo" });

  const threads = await db
    .select({
      id: chatThreadTable.id,
      title: chatThreadTable.title,
      updatedAt: chatThreadTable.updatedAt,
    })
    .from(chatThreadTable)
    .where(eq(chatThreadTable.userId, user.id))
    .orderBy(desc(chatThreadTable.updatedAt))
    .limit(20);

  if (!threads.length) return NextResponse.json({ threads: chatThreads, source: "demo" });
  const threadIds = threads.map((thread) => thread.id);
  const messages = await db
    .select({
      id: chatMessages.id,
      threadId: chatMessages.threadId,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(inArray(chatMessages.threadId, threadIds))
    .orderBy(asc(chatMessages.createdAt));

  const messagesByThread = new Map<string, ChatMessage[]>();
  for (const message of messages) {
    const list = messagesByThread.get(message.threadId) ?? [];
    list.push({
      id: message.id,
      role: message.role === "user" ? "user" : "agent",
      text: message.content,
      createdAt: message.createdAt.toISOString(),
    });
    messagesByThread.set(message.threadId, list);
  }

  const payload: ChatThread[] = threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    updated: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(thread.updatedAt),
    messages: messagesByThread.get(thread.id) ?? [],
  }));

  return NextResponse.json({ threads: payload, source: "live" });
}
