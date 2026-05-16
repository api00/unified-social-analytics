import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { chatThreads } from "../../../data/chat";
import { hasOpenAIEnv } from "../../../lib/env";
import { getOverviewForUser, summarizeOverviewForPrompt } from "../../../lib/analytics/overview";
import { createSupabaseServiceClient, getAuthenticatedUser } from "../../../lib/supabase/server";
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
  const user = await getAuthenticatedUser();
  const supabase = createSupabaseServiceClient();
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const message = body.message?.trim();

  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  if (!supabase || !user) {
    const messages: ChatMessage[] = [
      ...chatThreads[0].messages,
      { id: crypto.randomUUID(), role: "user", text: message },
      { id: crypto.randomUUID(), role: "agent", text: fallbackAdvice(message) },
    ];
    return NextResponse.json({ threadId: "demo", messages, source: "demo" });
  }

  let threadId = body.threadId;
  if (!threadId || threadId === "new" || threadId === "demo") {
    const { data: thread, error } = await supabase
      .from("chat_threads")
      .insert({
        user_id: user.id,
        title: message.slice(0, 54),
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !thread) return NextResponse.json({ error: error?.message ?? "Could not create chat thread." }, { status: 500 });
    threadId = thread.id;
  }

  await supabase.from("chat_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "user",
    content: message,
  });

  const overview = await getOverviewForUser(supabase, user.id);
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

  await supabase.from("chat_messages").insert({
    thread_id: threadId,
    user_id: user.id,
    role: "agent",
    content: answer,
  });

  await supabase
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", user.id);

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id,role,content,created_at")
    .eq("thread_id", threadId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; role: "user" | "agent"; content: string; created_at: string }>>();

  return NextResponse.json({
    threadId,
    messages: (messages ?? []).map((item) => ({
      id: item.id,
      role: item.role,
      text: item.content,
      createdAt: item.created_at,
    })),
    source: hasOpenAIEnv() ? "live" : "fallback",
  });
}
