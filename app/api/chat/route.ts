import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { hasOpenAIEnv } from "../../../lib/env";
import { getOverviewForUser, summarizeOverviewForPrompt } from "../../../lib/analytics/overview";
import { db } from "../../../db";
import { chatMessages, chatThreads as chatThreadTable } from "../../../db/schema";
import { getCurrentUser } from "../../../lib/current-user";

type ChatRequest = {
  threadId?: string;
  message?: string;
};

function fallbackAdvice(question: string) {
  if (/youtube/i.test(question)) {
    return "Cut your strongest YouTube video into 3 short clips, lead each with a specific hook, and publish the clearest lesson as a carousel.";
  }
  return "Lean into the format already proving demand. Keep the first 2 seconds concrete and reuse the structure of your top-performing post.";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to chat with the advisor." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  let threadId = body.threadId;
  if (!threadId || threadId === "new") {
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
  });
}
