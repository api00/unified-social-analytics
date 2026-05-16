import type { ChatMessage, ChatThread } from "../types/analytics";

export const advisorMessages: ChatMessage[] = [
  {
    id: 1,
    role: "agent",
    text: "I reviewed the current demo week. TikTok is carrying audience growth, YouTube is stronger for deeper education, and Instagram needs more save-driven carousel angles.",
  },
  {
    id: 2,
    role: "user",
    text: "What should I focus on next week?",
  },
  {
    id: 3,
    role: "agent",
    text: "Double down on short-form analytics breakdowns. Publish 3 TikToks from the best YouTube teardown, then turn the clearest lesson into an Instagram carousel with a strong save prompt.",
  },
];

export const chatThreads: ChatThread[] = [
  {
    id: "growth-plan",
    title: "Next week growth plan",
    updated: "Today",
    messages: advisorMessages,
  },
  {
    id: "tiktok",
    title: "TikTok momentum",
    updated: "Yesterday",
    messages: [
      {
        id: 1,
        role: "agent",
        text: "TikTok is the strongest growth source this week. Keep the clips short, lead with the result, and repeat the best hook structure from Friday.",
      },
      {
        id: 2,
        role: "user",
        text: "What should I change there?",
      },
      {
        id: 3,
        role: "agent",
        text: "Post more teardown-style clips and fewer broad updates. The specific analytics examples are doing the work.",
      },
    ],
  },
  {
    id: "instagram",
    title: "Instagram recovery",
    updated: "May 15",
    messages: [
      {
        id: 1,
        role: "agent",
        text: "Instagram needs clearer save value. Turn one winning idea into a carousel with a direct checklist or comparison format.",
      },
    ],
  },
];
