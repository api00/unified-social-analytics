import type { NetworkMetric, OverviewData, PlatformOption, TopContentItem } from "../types/analytics";

export const platformOptions: PlatformOption[] = [
  { id: "all", label: "All networks", short: "All" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "instagram", label: "Instagram", short: "IG" },
];

export const networkMetrics: OverviewData["networkMetrics"] = {
  all: {
    label: "All networks",
    views: 4350000,
    audience: 73600,
    engagement: "8.4%",
    posts: 42,
    growth: "+23.8%",
    conversion: "3.1x",
  },
  youtube: {
    label: "YouTube",
    views: 1320000,
    audience: 18200,
    engagement: "7.2%",
    posts: 12,
    growth: "+14.1%",
    conversion: "2.4x",
  },
  tiktok: {
    label: "TikTok",
    views: 2110000,
    audience: 42800,
    engagement: "10.6%",
    posts: 18,
    growth: "+31.5%",
    conversion: "4.6x",
  },
  instagram: {
    label: "Instagram",
    views: 920000,
    audience: 12600,
    engagement: "6.8%",
    posts: 12,
    growth: "+9.7%",
    conversion: "1.9x",
  },
};

export const weeklySeries = [
  { day: "Mon", youtube: 168000, tiktok: 252000, instagram: 112000 },
  { day: "Tue", youtube: 184000, tiktok: 298000, instagram: 126000 },
  { day: "Wed", youtube: 206000, tiktok: 316000, instagram: 141000 },
  { day: "Thu", youtube: 190000, tiktok: 342000, instagram: 132000 },
  { day: "Fri", youtube: 226000, tiktok: 388000, instagram: 164000 },
  { day: "Sat", youtube: 212000, tiktok: 274000, instagram: 151000 },
  { day: "Sun", youtube: 134000, tiktok: 240000, instagram: 94000 },
].map((item) => ({
  ...item,
  total: item.youtube + item.tiktok + item.instagram,
}));

export const audienceMix = [
  { name: "YouTube", value: 18200 },
  { name: "TikTok", value: 42800 },
  { name: "Instagram", value: 12600 },
];

export const contentByFormat = [
  { name: "Shorts", views: 1460000, saves: 18200 },
  { name: "Tutorials", views: 820000, saves: 9600 },
  { name: "Reels", views: 710000, saves: 7200 },
  { name: "Behind scenes", views: 530000, saves: 4900 },
  { name: "Lives", views: 360000, saves: 2100 },
];

export const topContent: TopContentItem[] = [
  {
    id: 1,
    title: "How I plan a full launch week in 20 minutes",
    platform: "TikTok",
    type: "Short video",
    views: 486000,
    audience: 9600,
    engagement: "12.4%",
    finding: "Hook mentions the payoff in the first 2 seconds.",
  },
  {
    id: 2,
    title: "Creator dashboard teardown: what I track daily",
    platform: "YouTube",
    type: "Long form",
    views: 312000,
    audience: 5100,
    engagement: "8.1%",
    finding: "Retention spikes when the dashboard appears on-screen.",
  },
  {
    id: 3,
    title: "Three analytics signals I never ignore",
    platform: "Instagram",
    type: "Carousel",
    views: 224000,
    audience: 2800,
    engagement: "9.6%",
    finding: "Saves outperform likes by 2.8x.",
  },
  {
    id: 4,
    title: "Repurposing one YouTube idea into five posts",
    platform: "TikTok",
    type: "Short video",
    views: 218000,
    audience: 4300,
    engagement: "10.9%",
    finding: "Fast cuts beat static talking head clips.",
  },
  {
    id: 5,
    title: "The follower graph that exposed my content gap",
    platform: "YouTube",
    type: "Shorts",
    views: 164000,
    audience: 2900,
    engagement: "7.7%",
    finding: "Audience converts after educational comparison posts.",
  },
];

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

export const demoOverview: OverviewData = {
  source: "demo",
  dateRange: "May 10-16",
  platformOptions,
  networkMetrics,
  weeklySeries,
  audienceMix,
  contentByFormat,
  topContent,
};
