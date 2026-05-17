import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { chatThreads } from "../../../data/chat";
import { hasOpenAIEnv } from "../../../lib/env";
import { getOverviewForUser, summarizeOverviewForPrompt } from "../../../lib/analytics/overview";
import { db } from "../../../db";
import { chatMessages, chatThreads as chatThreadTable } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/current-user";
import type { ChatMessage } from "../../../types/analytics";

type ChatRequest = {
  threadId?: string;
  message?: string;
};

function fallbackAdvice(question: string) {
  if (/youtube/i.test(question)) {
    return "Use the strongest YouTube teardown as the source asset: cut it into 3 short clips, keep each hook specific, and publish the clearest lesson as a carousel.";
  }

  return "Focus on the format already proving demand: short analytics breakdowns. Keep the first 2 seconds concrete, reuse the winning teardown topic, and add one save-driven Instagram carousel.";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const message = body.message?.trim();

  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (!user) {
    const messages: ChatMessage[] = [
      ...chatThreads[0].messages,
      { id: crypto.randomUUID(), role: "user", text: message },
      { id: crypto.randomUUID(), role: "agent", text: fallbackAdvice(message) },
    ];
    return NextResponse.json({ threadId: "demo", messages, source: "demo" });
  }

  let threadId = body.threadId;
  if (!threadId || threadId === "new" || threadId === "demo") {
    const [thread] = await db
      .insert(chatThreadTable)
      .values({
        userId: user.id,
        title: message.slice(0, 54),
      })
      .returning({ id: chatThreadTable.id });

    if (!thread) return NextResponse.json({ error: "Could not create chat thread." }, { status: 500 });
    threadId = thread.id;
  } else {
    const [thread] = await db
      .select({ id: chatThreadTable.id })
      .from(chatThreadTable)
      .where(and(eq(chatThreadTable.id, threadId), eq(chatThreadTable.userId, user.id)))
      .limit(1);

    if (!thread) return NextResponse.json({ error: "Chat thread was not found." }, { status: 404 });
  }

  await db.insert(chatMessages).values({
    threadId,
    userId: user.id,
    role: "user",
    content: message,
  });

  const overview = await getOverviewForUser(user.id);
  const analyticsContext = summarizeOverviewForPrompt(overview);

  let answer = fallbackAdvice(message);

  if (hasOpenAIEnv()) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions:
        "You are a concise professional social media growth strategist. Use the analytics context. Give specific next actions, avoid generic advice, and keep the answer under 140 words.",
      input: `Analytics context:\n${analyticsContext}\n\nUser question:\n${message}`,
    });
    answer = response.output_text || answer;
  }

  await db.insert(chatMessages).values({
    threadId,
    userId: user.id,
    role: "agent",
    content: answer,
  });

  await db
    .update(chatThreadTable)
    .set({ updatedAt: new Date() })
    .where(and(eq(chatThreadTable.id, threadId), eq(chatThreadTable.userId, user.id)));

  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.threadId, threadId), eq(chatMessages.userId, user.id)))
    .orderBy(chatMessages.createdAt);

  return NextResponse.json({
    threadId,
    messages: messages.map((item) => ({
      id: item.id,
      role: item.role === "user" ? "user" : "agent",
      text: item.content,
      createdAt: item.createdAt.toISOString(),
    })),
    source: hasOpenAIEnv() ? "live" : "fallback",
  });
}
