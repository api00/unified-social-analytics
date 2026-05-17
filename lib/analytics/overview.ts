import { and, desc, eq, gte } from "drizzle-orm";
import { buildEmptyOverview, formatCompactNumber, platformOptions } from "../../data/analytics";
import { db } from "../../db";
import { analyticsDaily, contentItems, xAccounts, youtubeChannels } from "../../db/schema";
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

type DailyRow = {
  date: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export async function getOverviewForUser(userId: string, range: TimeRange = "7d"): Promise<OverviewData> {
  const [youtubeRows, xRows] = await Promise.all([
    db
      .select({
        subscriberCount: youtubeChannels.subscriberCount,
        videoCount: youtubeChannels.videoCount,
        viewCount: youtubeChannels.viewCount,
      })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, userId)),
    db
      .select({
        followersCount: xAccounts.followersCount,
        tweetCount: xAccounts.tweetCount,
      })
      .from(xAccounts)
      .where(eq(xAccounts.userId, userId)),
  ]);

  if (!youtubeRows.length && !xRows.length) return buildEmptyOverview();

  const { startDate, rangeLabel, useDayLabel } = resolveRange(range);

  const dailyRows = (await db
    .select({
      date: analyticsDaily.date,
      platform: analyticsDaily.platform,
      views: analyticsDaily.views,
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
    .orderBy(analyticsDaily.date)) as DailyRow[];

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
    .limit(8);

  const isLifetime = range === "all";

  const ytLifetimeViews = youtubeRows.reduce((sum, row) => sum + Number(row.viewCount ?? 0), 0);
  const ytAudience = youtubeRows.reduce((sum, row) => sum + Number(row.subscriberCount ?? 0), 0);
  const ytPosts = youtubeRows.reduce((sum, row) => sum + Number(row.videoCount ?? 0), 0);

  const xAudience = xRows.reduce((sum, row) => sum + Number(row.followersCount ?? 0), 0);
  const xPosts = xRows.reduce((sum, row) => sum + Number(row.tweetCount ?? 0), 0);

  const platformDailyTotals = (platform: string) =>
    dailyRows
      .filter((row) => row.platform === platform)
      .reduce(
        (acc, row) => {
          acc.views += Number(row.views ?? 0);
          acc.engagement += Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0);
          return acc;
        },
        { views: 0, engagement: 0 }
      );

  const ytTotals = platformDailyTotals("youtube");
  const xTotals = platformDailyTotals("x");

  const ytViews = isLifetime ? ytLifetimeViews : ytTotals.views;
  const xViews = xTotals.views;
  const totalViews = ytViews + xViews;
  const totalAudience = ytAudience + xAudience;
  const totalPostsCombined = ytPosts + xPosts;
  const totalEngagement = ytTotals.engagement + xTotals.engagement;
  const engagementRate = totalViews ? `${((totalEngagement / totalViews) * 100).toFixed(1)}%` : "0%";

  const byDate = new Map<string, { youtube: number; x: number; tiktok: number; instagram: number }>();
  for (const row of dailyRows) {
    const date = String(row.date);
    const entry = byDate.get(date) ?? { youtube: 0, x: 0, tiktok: 0, instagram: 0 };
    if (row.platform === "youtube") entry.youtube += Number(row.views ?? 0);
    else if (row.platform === "x") entry.x += Number(row.views ?? 0);
    else if (row.platform === "tiktok") entry.tiktok += Number(row.views ?? 0);
    else if (row.platform === "instagram") entry.instagram += Number(row.views ?? 0);
    byDate.set(date, entry);
  }

  const weeklySeries: WeeklySeriesPoint[] = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, values]) => ({
      day: useDayLabel ? dayLabel(date) : shortDateLabel(date),
      youtube: values.youtube,
      tiktok: values.tiktok,
      instagram: values.instagram,
      x: values.x,
      total: values.youtube + values.x + values.tiktok + values.instagram,
    }));

  const topContent: TopContentItem[] = contentRows.slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    platform: item.platform,
    type: item.contentType,
    views: Number(item.views ?? 0),
    audience: undefined,
    engagement: item.views ? `${((Number(item.engagementCount ?? 0) / Number(item.views)) * 100).toFixed(1)}%` : "0%",
    url: item.url,
  }));

  const formatViews = contentRows.reduce<Record<string, number>>((acc, item) => {
    acc[item.contentType] = (acc[item.contentType] ?? 0) + Number(item.views ?? 0);
    return acc;
  }, {});

  const firstTotal = weeklySeries[0]?.total ?? 0;
  const lastTotal = weeklySeries[weeklySeries.length - 1]?.total ?? 0;
  const growthLabel = isLifetime ? "Lifetime" : percentChange(firstTotal, lastTotal);

  const audienceMix = [
    ytAudience > 0 ? { name: "youtube", value: ytAudience } : null,
    xAudience > 0 ? { name: "x", value: xAudience } : null,
  ].filter(Boolean) as { name: string; value: number }[];

  return {
    source: "live",
    dateRange: rangeLabel,
    platformOptions,
    weeklySeries,
    audienceMix,
    contentByFormat: Object.entries(formatViews).map(([name, views]) => ({ name, views })),
    topContent,
    networkMetrics: {
      all: {
        label: "All networks",
        views: totalViews,
        audience: totalAudience,
        engagement: engagementRate,
        posts: totalPostsCombined,
        growth: growthLabel,
        conversion: "Live",
      },
      youtube: {
        label: "YouTube",
        views: ytViews,
        audience: ytAudience,
        engagement: ytTotals.views ? `${((ytTotals.engagement / ytTotals.views) * 100).toFixed(1)}%` : "0%",
        posts: ytPosts,
        growth: isLifetime ? "Lifetime" : percentChange(weeklySeries[0]?.youtube ?? 0, weeklySeries[weeklySeries.length - 1]?.youtube ?? 0),
        conversion: youtubeRows.length ? "Live" : "—",
      },
      x: {
        label: "X",
        views: xViews,
        audience: xAudience,
        engagement: xTotals.views ? `${((xTotals.engagement / xTotals.views) * 100).toFixed(1)}%` : "0%",
        posts: xPosts,
        growth: percentChange(weeklySeries[0]?.x ?? 0, weeklySeries[weeklySeries.length - 1]?.x ?? 0),
        conversion: xRows.length ? "Live" : "—",
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
