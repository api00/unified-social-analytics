import type { ChannelAccount } from "../types/analytics";

export const channelStats = [
  { label: "Connected channels", value: "6", detail: "+2 this month" },
  { label: "Healthy syncs", value: "5", detail: "1 needs review" },
  { label: "Queued imports", value: "18", detail: "next sync 12 min" },
];

export const channelAccounts: ChannelAccount[] = [
  {
    id: 1,
    platform: "youtube",
    name: "Oliver Henry",
    handle: "@oliverhenry",
    status: "Synced",
    cadence: "Every 30 min",
    posts: 128,
    reach: "1.3M",
  },
  {
    id: 2,
    platform: "tiktok",
    name: "Oliver Builds",
    handle: "@oliverbuilds",
    status: "Synced",
    cadence: "Every 15 min",
    posts: 86,
    reach: "2.1M",
  },
  {
    id: 3,
    platform: "instagram",
    name: "Oliver Henry",
    handle: "@oliverhenry",
    status: "Synced",
    cadence: "Hourly",
    posts: 74,
    reach: "920K",
  },
  {
    id: 4,
    platform: "youtube",
    name: "Creator Lab",
    handle: "@creatorlab",
    status: "Review",
    cadence: "Paused",
    posts: 31,
    reach: "214K",
  },
];
