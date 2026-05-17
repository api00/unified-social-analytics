import type { OverviewData, PlatformOption } from "../types/analytics";

export const platformOptions: PlatformOption[] = [
  { id: "all", label: "All networks", short: "All" },
  { id: "youtube", label: "YouTube", short: "YT" },
  { id: "tiktok", label: "TikTok", short: "TT" },
  { id: "instagram", label: "Instagram", short: "IG" },
];

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000000 ? 1 : 0,
  }).format(value);
}

function emptyMetric(label: string) {
  return {
    label,
    views: 0,
    audience: 0,
    engagement: "0%",
    posts: 0,
    growth: "0%",
    conversion: "—",
  };
}

export function buildEmptyOverview(): OverviewData {
  return {
    source: "empty",
    dateRange: "",
    platformOptions,
    weeklySeries: [],
    audienceMix: [],
    contentByFormat: [],
    topContent: [],
    networkMetrics: {
      all: emptyMetric("All networks"),
      youtube: emptyMetric("YouTube"),
      tiktok: emptyMetric("TikTok"),
      instagram: emptyMetric("Instagram"),
    },
  };
}
