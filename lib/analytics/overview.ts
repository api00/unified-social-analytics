import type { SupabaseClient } from "@supabase/supabase-js";
import { demoOverview, formatCompactNumber, platformOptions } from "../../data/analytics";
import type { OverviewData, TopContentItem, WeeklySeriesPoint } from "../../types/analytics";

type DailyRow = {
  date: string;
  views: number;
  subscribers_gained: number;
  subscribers_lost: number;
  likes: number;
  comments: number;
  shares: number;
};

type ChannelRow = {
  subscriber_count: number;
  video_count: number;
  view_count: number;
};

type ContentRow = {
  id: string;
  external_id: string;
  title: string;
  platform: string;
  content_type: string;
  views: number;
  engagement_count: number;
  url: string | null;
};

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

export async function getOverviewForUser(supabase: SupabaseClient, userId: string): Promise<OverviewData> {
  const { data: channels, error: channelError } = await supabase
    .from("youtube_channels")
    .select("subscriber_count,video_count,view_count")
    .eq("user_id", userId)
    .returns<ChannelRow[]>();

  if (channelError || !channels?.length) return demoOverview;

  const startDate = dateDaysAgo(6);
  const { data: dailyRows } = await supabase
    .from("analytics_daily")
    .select("date,views,subscribers_gained,subscribers_lost,likes,comments,shares")
    .eq("user_id", userId)
    .gte("date", startDate)
    .order("date", { ascending: true })
    .returns<DailyRow[]>();

  const { data: contentRows } = await supabase
    .from("content_items")
    .select("id,external_id,title,platform,content_type,views,engagement_count,url")
    .eq("user_id", userId)
    .order("views", { ascending: false })
    .limit(5)
    .returns<ContentRow[]>();

  const rows = dailyRows ?? [];
  const totalViews = rows.reduce((sum, row) => sum + Number(row.views ?? 0), 0) || channels.reduce((sum, row) => sum + Number(row.view_count ?? 0), 0);
  const totalAudience = channels.reduce((sum, row) => sum + Number(row.subscriber_count ?? 0), 0);
  const totalPosts = channels.reduce((sum, row) => sum + Number(row.video_count ?? 0), 0);
  const totalEngagement = rows.reduce(
    (sum, row) => sum + Number(row.likes ?? 0) + Number(row.comments ?? 0) + Number(row.shares ?? 0),
    0
  );
  const engagementRate = totalViews ? `${((totalEngagement / totalViews) * 100).toFixed(1)}%` : "0%";

  const weeklySeries: WeeklySeriesPoint[] = rows.length
    ? rows.map((row) => ({
        day: dayLabel(row.date),
        youtube: Number(row.views ?? 0),
        tiktok: 0,
        instagram: 0,
        total: Number(row.views ?? 0),
      }))
    : demoOverview.weeklySeries.map((row) => ({ ...row, tiktok: 0, instagram: 0, total: row.youtube }));

  const topContent: TopContentItem[] = contentRows?.length
    ? contentRows.map((item) => ({
        id: item.id,
        title: item.title,
        platform: "youtube",
        type: item.content_type,
        views: Number(item.views ?? 0),
        audience: undefined,
        engagement: item.views ? `${((Number(item.engagement_count ?? 0) / Number(item.views)) * 100).toFixed(1)}%` : "0%",
        url: item.url,
      }))
    : demoOverview.topContent.filter((item) => item.platform.toLowerCase() === "youtube");

  const formatViews = topContent.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + item.views;
    return acc;
  }, {});

  const firstViews = weeklySeries[0]?.youtube ?? 0;
  const lastViews = weeklySeries[weeklySeries.length - 1]?.youtube ?? 0;

  return {
    source: "live",
    dateRange: `${startDate} to ${dateDaysAgo(0)}`,
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
