import { NextResponse } from "next/server";
import { channelAccounts } from "../../../data/channels";
import { formatCompactNumber } from "../../../data/analytics";
import { createSupabaseServiceClient, getAuthenticatedUser } from "../../../lib/supabase/server";
import type { ChannelAccount } from "../../../types/analytics";

type YouTubeChannelRecord = {
  id: string;
  title: string;
  handle: string | null;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  last_synced_at: string | null;
  thumbnail_url: string | null;
};

export async function GET() {
  const user = await getAuthenticatedUser();
  const supabase = createSupabaseServiceClient();

  if (!supabase) return NextResponse.json({ channels: channelAccounts, source: "demo" });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("youtube_channels")
    .select("id,title,handle,subscriber_count,view_count,video_count,last_synced_at,thumbnail_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<YouTubeChannelRecord[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const channels: ChannelAccount[] = (data ?? []).map((channel) => ({
    id: channel.id,
    platform: "youtube",
    name: channel.title,
    handle: channel.handle ?? "@youtube",
    status: channel.last_synced_at ? "Synced" : "Needs sync",
    cadence: channel.last_synced_at ? "Synced recently" : "Not synced yet",
    posts: Number(channel.video_count ?? 0),
    reach: formatCompactNumber(Number(channel.view_count ?? 0)),
    thumbnailUrl: channel.thumbnail_url,
  }));

  return NextResponse.json({ channels, source: channels.length ? "live" : "demo" });
}
