export type SocialPlatformId = "youtube" | "tiktok" | "instagram";
export type SocialBrandId = SocialPlatformId | "facebook" | "x";
export type PlatformId = "all" | SocialPlatformId;
export type DataSource = "empty" | "live";
export type TimeRange = "24h" | "7d" | "30d" | "6m" | "all";

export const TIME_RANGES: TimeRange[] = ["24h", "7d", "30d", "6m", "all"];

export type PlatformOption = {
  id: PlatformId;
  label: string;
  short: string;
};

export type NetworkMetric = {
  label: string;
  views: number;
  audience: number;
  engagement: string;
  posts: number;
  growth: string;
  conversion: string;
};

export type WeeklySeriesPoint = {
  day: string;
  youtube: number;
  tiktok: number;
  instagram: number;
  total: number;
};

export type AudienceMixItem = {
  name: SocialPlatformId | string;
  value: number;
};

export type ContentFormatDatum = {
  name: string;
  views: number;
  saves?: number;
};

export type TopContentItem = {
  id: string | number;
  title: string;
  platform: SocialPlatformId | string;
  type: string;
  views: number;
  audience?: number;
  engagement?: string;
  finding?: string;
  url?: string | null;
};

export type OverviewData = {
  source: DataSource;
  dateRange: string;
  platformOptions: PlatformOption[];
  networkMetrics: Record<PlatformId, NetworkMetric>;
  weeklySeries: WeeklySeriesPoint[];
  audienceMix: AudienceMixItem[];
  contentByFormat: ContentFormatDatum[];
  topContent: TopContentItem[];
};

export type ChannelAccount = {
  id: string | number;
  platform: SocialPlatformId | string;
  name: string;
  handle: string;
  status: "Synced" | "Review" | "Needs sync" | "Syncing" | "Error";
  cadence: string;
  posts: number;
  reach: string;
  thumbnailUrl?: string | null;
};

export type ChatMessage = {
  id: string | number;
  role: "agent" | "user";
  text: string;
  createdAt?: string;
};

export type ChatThread = {
  id: string;
  title: string;
  updated: string;
  messages: ChatMessage[];
};
