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
        "You are a senior cross-platform social media growth strategist for a creator. Output is rendered as markdown.",
        "",
        "FIRST decide the response mode based on the user's message:",
        "",
        "MODE A — Greeting or small talk ('hi', 'hello', 'thanks', 'how are you', single emoji, etc.):",
        "- Reply in 1–2 friendly sentences. Be warm but brief.",
        "- Mention 1 example of what you can do (e.g., 'Ask me which format is winning or what to post next').",
        "- DO NOT include tables, headings, numbered action lists, or analytics dumps.",
        "",
        "MODE B — Vague open question with no clear analytical ask ('what do you think', 'any tips'):",
        "- Reply in 2–3 sentences with the single most interesting pattern from their data and ONE concrete next move.",
        "- DO NOT use a table or headings unless it genuinely clarifies. Keep it conversational.",
        "",
        "MODE C — Analytical question (compare, why, what should I do, find best, top, what's working, etc.):",
        "- Lead with ONE bold-leading-insight line (≤ 20 words) with **the key number bolded**.",
        "- If comparing 2+ formats / platforms / periods, render a markdown table (max 5 rows, max 4 columns).",
        "- End with `### Next moves` followed by 2–3 numbered actions. Each: **bold verb** + one sentence + supporting data point in parentheses.",
        "- Total under 150 words.",
        "",
        "Universal rules:",
        "- ALWAYS ground claims in specific numbers, post titles, dates, or formats from the data.",
        "- If a platform has < 10 data points, recommend tests rather than conclusions.",
        "- Prefer last-30-day trends for short-term advice. Lifetime stats are background only.",
        "- No filler ('Great question', 'Based on your data'). Start with content.",
        "- Use markdown only (bold, tables, numbered lists, ### headings). No raw HTML.",
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
