import { and, desc, eq, gte } from "drizzle-orm";
import { buildEmptyOverview, formatCompactNumber, platformOptions } from "../../data/analytics";
import { db } from "../../db";
import { analyticsDaily, contentItems, youtubeChannels } from "../../db/schema";
import type { OverviewData, TopContentItem, WeeklySeriesPoint } from "../../types/analytics";

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dayLabel(dateString: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(dateString));
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

export async function getOverviewForUser(userId: string): Promise<OverviewData> {
  const channels = await db
    .select({
      subscriberCount: youtubeChannels.subscriberCount,
      videoCount: youtubeChannels.videoCount,
      viewCount: youtubeChannels.viewCount,
    })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.userId, userId));

  if (!channels.length) return buildEmptyOverview();

  const startDate = dateDaysAgo(6);
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
    .where(and(eq(analyticsDaily.userId, userId), gte(analyticsDaily.date, startDate)))
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

  const rows = dailyRows;
  const totalViews = rows.reduce((sum, row) => sum + Number(row.views ?? 0), 0) || channels.reduce((sum, row) => sum + Number(row.viewCount ?? 0), 0);
  const totalAudience = channels.reduce((sum, row) => sum + Number(row.subscriberCount ?? 0), 0);
  const totalPosts = channels.reduce((sum, row) => sum + Number(row.videoCount ?? 0), 0);
  const totalEngagement = rows.reduce(
    (sum, row) => sum + Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0),
    0
  );
  const engagementRate = totalViews ? `${((totalEngagement / totalViews) * 100).toFixed(1)}%` : "0%";

  const weeklySeries: WeeklySeriesPoint[] = rows.map((row) => ({
    day: dayLabel(row.date),
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

  return {
    source: "live",
    dateRange: formatDateRange(startDate, dateDaysAgo(0)),
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
        growth: percentChange(firstViews, lastViews),
        conversion: "Live",
      },
      youtube: {
        label: "YouTube",
        views: totalViews,
        audience: totalAudience,
        engagement: engagementRate,
        posts: totalPosts,
        growth: percentChange(firstViews, lastViews),
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
