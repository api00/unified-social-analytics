import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("youtube"),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    rawProfile: jsonb("raw_profile").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("connected_accounts_user_provider_account_idx").on(table.userId, table.provider, table.providerAccountId),
    index("connected_accounts_user_provider_idx").on(table.userId, table.provider),
  ]
);

export const youtubeChannels = pgTable(
  "youtube_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    youtubeChannelId: text("youtube_channel_id").notNull(),
    title: text("title").notNull(),
    handle: text("handle"),
    thumbnailUrl: text("thumbnail_url"),
    subscriberCount: bigint("subscriber_count", { mode: "number" }).notNull().default(0),
    viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
    videoCount: bigint("video_count", { mode: "number" }).notNull().default(0),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("youtube_channels_user_channel_idx").on(table.userId, table.youtubeChannelId),
    index("youtube_channels_user_idx").on(table.userId),
  ]
);

export const xAccounts = pgTable(
  "x_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectedAccountId: uuid("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    xUserId: text("x_user_id").notNull(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    profileImageUrl: text("profile_image_url"),
    description: text("description"),
    followersCount: bigint("followers_count", { mode: "number" }).notNull().default(0),
    followingCount: bigint("following_count", { mode: "number" }).notNull().default(0),
    tweetCount: bigint("tweet_count", { mode: "number" }).notNull().default(0),
    listedCount: bigint("listed_count", { mode: "number" }).notNull().default(0),
    verified: boolean("verified").notNull().default(false),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("x_accounts_user_x_idx").on(table.userId, table.xUserId),
    index("x_accounts_user_idx").on(table.userId),
  ]
);

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => youtubeChannels.id, { onDelete: "cascade" }),
    xAccountId: uuid("x_account_id").references(() => xAccounts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("youtube"),
    date: date("date").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    subscribersGained: bigint("subscribers_gained", { mode: "number" }).notNull().default(0),
    subscribersLost: bigint("subscribers_lost", { mode: "number" }).notNull().default(0),
    likes: bigint("likes", { mode: "number" }).notNull().default(0),
    comments: bigint("comments", { mode: "number" }).notNull().default(0),
    shares: bigint("shares", { mode: "number" }).notNull().default(0),
    estimatedMinutesWatched: numeric("estimated_minutes_watched").notNull().default("0"),
    source: text("source").notNull().default("youtube"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("analytics_daily_user_channel_platform_date_idx").on(table.userId, table.channelId, table.platform, table.date),
    index("analytics_daily_user_date_idx").on(table.userId, table.date),
  ]
);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => youtubeChannels.id, { onDelete: "cascade" }),
    xAccountId: uuid("x_account_id").references(() => xAccounts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull().default("youtube"),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    contentType: text("content_type").notNull().default("Video"),
    url: text("url"),
    thumbnailUrl: text("thumbnail_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    engagementCount: bigint("engagement_count", { mode: "number" }).notNull().default(0),
    rawMetrics: jsonb("raw_metrics").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_items_user_platform_external_idx").on(table.userId, table.platform, table.externalId),
    index("content_items_user_views_idx").on(table.userId, table.views),
  ]
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  connectedAccountId: uuid("connected_account_id").references(() => connectedAccounts.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("youtube"),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default({}),
});

export const chatThreads = pgTable(
  "chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_threads_user_updated_idx").on(table.userId, table.updatedAt)]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThreads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_messages_thread_created_idx").on(table.threadId, table.createdAt)]
);

export const usersRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  connectedAccounts: many(connectedAccounts),
  youtubeChannels: many(youtubeChannels),
  xAccounts: many(xAccounts),
  chatThreads: many(chatThreads),
}));

export const xAccountRelations = relations(xAccounts, ({ one }) => ({
  user: one(user, { fields: [xAccounts.userId], references: [user.id] }),
  connectedAccount: one(connectedAccounts, {
    fields: [xAccounts.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

export const youtubeChannelRelations = relations(youtubeChannels, ({ one }) => ({
  user: one(user, { fields: [youtubeChannels.userId], references: [user.id] }),
  connectedAccount: one(connectedAccounts, {
    fields: [youtubeChannels.connectedAccountId],
    references: [connectedAccounts.id],
  }),
}));

export type User = typeof user.$inferSelect;
export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type YouTubeChannel = typeof youtubeChannels.$inferSelect;
export type XAccount = typeof xAccounts.$inferSelect;
export type AnalyticsDaily = typeof analyticsDaily.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type ChatThreadRecord = typeof chatThreads.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;
