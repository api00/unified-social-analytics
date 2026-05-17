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

  const overview = await getOverviewForUser(user.id, "6m");
  const analyticsContext = summarizeOverviewForPrompt(overview);

  let answer = fallbackAdvice(message);

  if (hasOpenAIEnv()) {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      instructions: [
        "You are a senior cross-platform social media growth strategist analyzing a creator's analytics data.",
        "",
        "Style rules:",
        "- ALWAYS reference specific numbers, post titles, dates, or formats from the data — never give generic advice.",
        "- Compare formats and platforms to surface what is actually working (highest views per post, best engagement rate, fastest-growing).",
        "- Recommend 2–3 concrete next actions, ranked by expected impact, each tied back to a data point.",
        "- Acknowledge sparse data honestly: if a platform has < 10 data points, recommend tests rather than conclusions.",
        "- Treat lifetime stats as background context. Prefer trends in the last 30 days when giving short-term advice.",
        "",
        "Format: 120–200 words, plain prose. No markdown headers. Numbered list is OK if it improves clarity.",
      ].join("\n"),
      input: `User question:\n${message}\n\n--- ANALYTICS CONTEXT (last 6 months) ---\n${analyticsContext}`,
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
