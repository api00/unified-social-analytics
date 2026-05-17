import { and, desc, eq, gte } from "drizzle-orm";
import { buildEmptyOverview, formatCompactNumber, platformOptions } from "../../data/analytics";
import { db } from "../../db";
import { analyticsDaily, contentItems, youtubeChannels } from "../../db/schema";
import type { OverviewData, TimeRange, TopContentItem, WeeklySeriesPoint } from "../../types/analytics";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dayLabel(dateString: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(dateString));
}

function shortDateLabel(dateString: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(dateString));
}

function percentChange(first: number, last: number) {
  if (!first) return last ? "+100%" : "0%";
  const change = ((last - first) / first) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function formatDateRange(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(date);

  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  if (sameMonth) {
    return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { day: "numeric" })}`;
  }
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, { month: "short", day: "numeric" })}`;
}

type RangeConfig = {
  startDate: string | null;
  rangeLabel: string;
  useDayLabel: boolean;
};

function resolveRange(range: TimeRange): RangeConfig {
  const today = dateDaysAgo(0);
  switch (range) {
    case "24h":
      return { startDate: dateDaysAgo(1), rangeLabel: "Last 24 hours", useDayLabel: true };
    case "30d":
      return { startDate: dateDaysAgo(29), rangeLabel: formatDateRange(dateDaysAgo(29), today), useDayLabel: false };
    case "6m":
      return { startDate: dateDaysAgo(179), rangeLabel: "Last 6 months", useDayLabel: false };
    case "all":
      return { startDate: null, rangeLabel: "All time", useDayLabel: false };
    case "7d":
    default:
      return { startDate: dateDaysAgo(6), rangeLabel: formatDateRange(dateDaysAgo(6), today), useDayLabel: true };
  }
}

export async function getOverviewForUser(userId: string, range: TimeRange = "7d"): Promise<OverviewData> {
  const channels = await db
    .select({
      subscriberCount: youtubeChannels.subscriberCount,
      videoCount: youtubeChannels.videoCount,
      viewCount: youtubeChannels.viewCount,
    })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, userId));

  if (!channels.length) return buildEmptyOverview();

  const { startDate, rangeLabel, useDayLabel } = resolveRange(range);

  const dailyRows = await db
    .select({
      date: analyticsDaily.date,
      views: analyticsDaily.views,
      subscribersGained: analyticsDaily.subscribersGained,
      subscribersLost: analyticsDaily.subscribersLost,
      likes: analyticsDaily.likes,
      comments: analyticsDaily.comments,
      shares: analyticsDaily.shares,
    })
    .from(analyticsDaily)
    .where(
      startDate
        ? and(eq(analyticsDaily.userId, userId), gte(analyticsDaily.date, startDate))
        : eq(analyticsDaily.userId, userId)
    )
    .orderBy(analyticsDaily.date);

  const contentRows = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      platform: contentItems.platform,
      contentType: contentItems.contentType,
      views: contentItems.views,
      engagementCount: contentItems.engagementCount,
      url: contentItems.url,
    })
    .from(contentItems)
    .where(eq(contentItems.userId, userId))
    .orderBy(desc(contentItems.views))
    .limit(5);

  const isLifetime = range === "all";
  const lifetimeViews = channels.reduce((sum, row) => sum + Number(row.viewCount ?? 0), 0);
  const totalAudience = channels.reduce((sum, row) => sum + Number(row.subscriberCount ?? 0), 0);
  const totalPosts = channels.reduce((sum, row) => sum + Number(row.videoCount ?? 0), 0);

  const periodViews = dailyRows.reduce((sum, row) => sum + Number(row.views ?? 0), 0);
  const periodEngagement = dailyRows.reduce(
    (sum, row) => sum + Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0),
    0
  );

  const totalViews = isLifetime ? lifetimeViews : periodViews;
  const engagementBase = isLifetime ? lifetimeViews : periodViews;
  const engagementRate = engagementBase ? `${((periodEngagement / engagementBase) * 100).toFixed(1)}%` : "0%";

  const weeklySeries: WeeklySeriesPoint[] = dailyRows.map((row) => ({
    day: useDayLabel ? dayLabel(row.date) : shortDateLabel(row.date),
    youtube: Number(row.views ?? 0),
    tiktok: 0,
    instagram: 0,
    total: Number(row.views ?? 0),
  }));

  const topContent: TopContentItem[] = contentRows.map((item) => ({
    id: item.id,
    title: item.title,
    platform: "youtube",
    type: item.contentType,
    views: Number(item.views ?? 0),
    audience: undefined,
    engagement: item.views ? `${((Number(item.engagementCount ?? 0) / Number(item.views)) * 100).toFixed(1)}%` : "0%",
    url: item.url,
  }));

  const formatViews = topContent.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + item.views;
    return acc;
  }, {});

  const firstViews = weeklySeries[0]?.youtube ?? 0;
  const lastViews = weeklySeries[weeklySeries.length - 1]?.youtube ?? 0;
  const growthLabel = isLifetime ? "Lifetime" : percentChange(firstViews, lastViews);

  return {
    source: "live",
    dateRange: rangeLabel,
    platformOptions,
    weeklySeries,
    audienceMix: [{ name: "youtube", value: totalAudience }],
    contentByFormat: Object.entries(formatViews).map(([name, views]) => ({ name, views })),
    topContent,
    networkMetrics: {
      all: {
        label: "YouTube",
        views: totalViews,
        audience: totalAudience,
        engagement: engagementRate,
        posts: totalPosts,
        growth: growthLabel,
        conversion: "Live",
      },
      youtube: {
        label: "YouTube",
        views: totalViews,
        audience: totalAudience,
        engagement: engagementRate,
        posts: totalPosts,
        growth: growthLabel,
        conversion: "Live",
      },
      tiktok: {
        label: "TikTok",
        views: 0,
        audience: 0,
        engagement: "0%",
        posts: 0,
        growth: "Planned",
        conversion: "v2",
      },
      instagram: {
        label: "Instagram",
        views: 0,
        audience: 0,
        engagement: "0%",
        posts: 0,
        growth: "Planned",
        conversion: "v2",
      },
    },
  };
}

export function summarizeOverviewForPrompt(overview: OverviewData) {
  const topPosts = overview.topContent
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.title} (${item.platform}, ${formatCompactNumber(item.views)} views)`)
    .join("\n");

  return [
    `Data source: ${overview.source}`,
    `Range: ${overview.dateRange}`,
    `Views: ${formatCompactNumber(overview.networkMetrics.all.views)}`,
    `Audience: ${formatCompactNumber(overview.networkMetrics.all.audience)}`,
    `Engagement: ${overview.networkMetrics.all.engagement}`,
    `Top posts:\n${topPosts || "No synced posts yet."}`,
  ].join("\n");
}
