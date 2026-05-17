"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Download,
  Eye,
  FileChartColumn,
  LayoutDashboard,
  ListVideo,
  LogOut,
  MessageSquareText,
  Plus,
  RadioTower,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { buildEmptyOverview } from "../data/analytics";
import type { NetworkMetric, OverviewData, PlatformId, PlatformOption, SocialPlatformId, TimeRange, TopContentItem } from "../types/analytics";
import { socialBrands } from "../data/socials";
import AuthModal from "./AuthModal";
import BrandLogo from "./BrandLogo";
import ChannelManager from "./ChannelManager";
import GrowthAdvisor from "./GrowthAdvisor";
import GrowthCharts from "./GrowthCharts";
import MetricCard from "./MetricCard";
import PlatformBreakdown from "./PlatformBreakdown";
import SocialLogo, { SocialLogoGroup } from "./SocialLogo";
import TopContentChart from "./TopContentChart";
import { getPlatformColor } from "../data/socials";
import { authClient } from "../lib/auth-client";

const navItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "channels", label: "Channels", icon: RadioTower },
  { id: "chat", label: "Chat", icon: MessageSquareText },
  { id: "content", label: "Content", icon: ListVideo },
  { id: "audience", label: "Audience", icon: UsersRound },
  { id: "reports", label: "Reports", icon: FileChartColumn },
];

type AppSection = "overview" | "channels" | "chat" | "content" | "audience" | "reports";

type InitialUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

type DashboardShellProps = {
  initialUser: InitialUser | null;
  authConfigured: boolean;
  initialChannelCount: number;
  initialPlatforms: SocialPlatformId[];
};

const sectionCopy: Record<AppSection, { title: string; description: string }> = {
  overview: {
    title: "Unified analytics",
    description: "One view for reach, audience growth, top posts, and channel trends.",
  },
  channels: {
    title: "Channels",
    description: "Connect accounts, review sync health, and control which profiles feed your analytics.",
  },
  chat: {
    title: "Growth chat",
    description: "Ask what is working, what is not, and what to do next.",
  },
  content: {
    title: "Content",
    description: "Review post performance, formats, and publishing patterns.",
  },
  audience: {
    title: "Audience",
    description: "Track subscriber growth and network-level audience movement.",
  },
  reports: {
    title: "Reports",
    description: "Prepare weekly snapshots and export-ready social analytics.",
  },
};

const rangeOptions: { id: TimeRange; label: string }[] = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "6m", label: "Last 6 months" },
  { id: "all", label: "All time" },
];

export default function DashboardShell({
  initialUser,
  authConfigured,
  initialChannelCount,
  initialPlatforms,
}: DashboardShellProps) {
  const router = useRouter();
  const [activePlatform, setActivePlatform] = useState<PlatformId>("all");
  const [activeSection, setActiveSection] = useState<AppSection>("overview");
  const [overviewData, setOverviewData] = useState<OverviewData>(buildEmptyOverview);
  const [channelCount, setChannelCount] = useState<number>(initialChannelCount);
  const [connectedPlatforms, setConnectedPlatforms] = useState<SocialPlatformId[]>(initialPlatforms);
  const [activeRange, setActiveRange] = useState<TimeRange>("7d");

  const updateChannelCount = (next: number) => setChannelCount(next);
  const updateConnectedPlatforms = (platforms: SocialPlatformId[]) => setConnectedPlatforms(platforms);

  const currentCopy = sectionCopy[activeSection] ?? sectionCopy.overview;
  const activeMetrics = overviewData.networkMetrics[activePlatform] ?? overviewData.networkMetrics.all;
  const filteredContent = useMemo<TopContentItem[]>(() => {
    if (activePlatform === "all") return overviewData.topContent;
    return overviewData.topContent.filter((item) => item.platform.toLowerCase() === activePlatform);
  }, [activePlatform, overviewData.topContent]);

  useEffect(() => {
    if (!initialUser) return;

    async function loadOverview() {
      const response = await fetch(`/api/analytics/overview?range=${activeRange}`);
      if (!response.ok) return;
      const payload = (await response.json()) as OverviewData;
      setOverviewData(payload);
      if (payload.source === "live") setChannelCount((current) => Math.max(current, 1));
    }

    void loadOverview();
  }, [initialUser, activeRange]);

  async function handleLogout() {
    await authClient.signOut();
    router.refresh();
  }

  const hasChannels = channelCount > 0;
  const showEmptyOverview = Boolean(initialUser) && !hasChannels;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="sidebar-header">
          <div className="brand-lockup" aria-label="Unified Social Analytics">
            <BrandLogo className="brand-mark" size={42} />
            <span className="brand-copy">
              <strong>Unified</strong>
              <small>Social Analytics</small>
            </span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Dashboard sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "nav-item is-active" : "nav-item"}
                key={item.label}
                onClick={() => setActiveSection(item.id as AppSection)}
                type="button"
              >
                <span className="nav-icon" aria-hidden="true">
                  <Icon size={17} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="sidebar-networks" aria-labelledby="sidebar-networks-title">
          <div className="sidebar-section-title">
            <span id="sidebar-networks-title">Connected networks</span>
            <small>{hasChannels ? `${channelCount} synced` : "Nothing connected"}</small>
          </div>
          {connectedPlatforms.length ? (
            <div className="network-stack">
              {connectedPlatforms.map((platform) => (
                <span className="network-pill" key={platform}>
                  <SocialLogo platform={platform} size={12} />
                  {socialBrands[platform]?.label ?? platform}
                </span>
              ))}
            </div>
          ) : (
            <button className="sidebar-connect-cta" type="button" onClick={() => setActiveSection("channels")}>
              <Plus size={13} aria-hidden="true" />
              Connect a channel
            </button>
          )}
        </section>

        <div className="sidebar-profile" aria-label="Profile actions">
          <div className="profile-avatar" aria-hidden="true">{getInitials(initialUser?.name ?? "Creator")}</div>
          <div className="profile-copy">
            <strong>{initialUser?.name ?? "Creator"}</strong>
            <small>{initialUser?.email || "Not signed in"}</small>
          </div>
          <button className="profile-logout" type="button" aria-label="Log out" onClick={handleLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className={activeSection === "chat" ? "dashboard-main is-chat" : "dashboard-main"}>
        <header className="topbar">
          <div className="topbar-copy">
            <h1>{currentCopy.title}</h1>
            <p>{currentCopy.description}</p>
          </div>

          {activeSection === "chat" ? null : (
            <div className="topbar-actions" aria-label="Dashboard tools">
              <label className="search-box">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Search analytics</span>
                <input placeholder={getSearchPlaceholder(activeSection)} />
              </label>
              <button className="icon-button" aria-label="Notifications">
                <Bell size={17} />
              </button>
              <label className="range-select-wrap">
                <CalendarDays size={16} aria-hidden="true" />
                <span className="sr-only">Date range</span>
                <select
                  className="range-select"
                  value={activeRange}
                  onChange={(event) => setActiveRange(event.target.value as TimeRange)}
                >
                  {rangeOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button className="primary-button">
                <Download size={16} />
                Export
              </button>
            </div>
          )}
        </header>

        {activeSection === "channels" ? (
          <ChannelManager
            isAuthenticated={Boolean(initialUser)}
            onChannelsChange={updateChannelCount}
            onPlatformsChange={updateConnectedPlatforms}
          />
        ) : activeSection === "chat" ? (
          <GrowthAdvisor isAuthenticated={Boolean(initialUser)} />
        ) : activeSection === "overview" ? (
          showEmptyOverview ? (
            <OverviewEmptyState onConnect={() => setActiveSection("channels")} />
          ) : (
            <OverviewDashboard
              activeMetrics={activeMetrics}
              activePlatform={activePlatform}
              filteredContent={filteredContent}
              overviewData={overviewData}
              setActivePlatform={setActivePlatform}
            />
          )
        ) : (
          <SectionPlaceholder section={currentCopy} />
        )}
      </main>

      {!initialUser ? <AuthModal authConfigured={authConfigured} /> : null}
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getSearchPlaceholder(section: AppSection) {
  if (section === "channels") return "Search connected channels";
  if (section === "chat") return "Search advice or findings";
  return "Search posts or channels";
}

function OverviewEmptyState({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="panel overview-empty"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="overview-empty-icon" aria-hidden="true">
        <RadioTower size={28} />
      </div>
      <p className="section-kicker">No channels connected</p>
      <h2>Connect a channel to see your analytics</h2>
      <span>Hook up YouTube and we will pull the last 7 days of views, audience, and top posts.</span>
      <button className="primary-button" type="button" onClick={onConnect}>
        <Plus size={16} />
        Connect YouTube
      </button>
    </motion.section>
  );
}

function OverviewDashboard({
  activeMetrics,
  activePlatform,
  filteredContent,
  overviewData,
  setActivePlatform,
}: {
  activeMetrics: NetworkMetric;
  activePlatform: PlatformId;
  filteredContent: TopContentItem[];
  overviewData: OverviewData;
  setActivePlatform: (platform: PlatformId) => void;
}) {
  return (
    <motion.div
      className="workspace-stack"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <section className="control-strip" aria-labelledby="dashboard-title">
        <div className="control-copy">
          <p className="section-kicker">Cross-channel summary</p>
          <h2 id="dashboard-title">{overviewData.dateRange || "Last 7 days"} performance</h2>
          <span>Live YouTube analytics from your connected channels.</span>
        </div>

        <div className="platform-tabs" role="tablist" aria-label="Filter analytics by platform">
          {overviewData.platformOptions.map((platform) => (
            <PlatformTab
              isActive={activePlatform === platform.id}
              key={platform.id}
              onClick={() => setActivePlatform(platform.id)}
              platform={platform}
            />
          ))}
        </div>
      </section>

      <section className="metric-row" aria-label={`${activeMetrics.label} key metrics`}>
        <MetricCard delta={activeMetrics.growth} icon={Eye} label="Views" value={activeMetrics.views} />
        <MetricCard delta="" icon={UsersRound} label="Audience" value={activeMetrics.audience} />
        <MetricCard delta="" icon={Sparkles} label="Engagement" textValue value={activeMetrics.engagement} />
        <MetricCard delta={activeMetrics.conversion} icon={ArrowUpRight} label="Posts tracked" textValue value={activeMetrics.posts} />
      </section>

      <section className="analytics-grid" aria-label="Overview analytics">
        <GrowthCharts
          activePlatform={activePlatform}
          contentByFormatData={overviewData.contentByFormat}
          source={overviewData.source}
          weeklySeriesData={overviewData.weeklySeries}
        />
        <TopContentChart items={filteredContent} />
        <PlatformBreakdown audienceMixData={overviewData.audienceMix} />
      </section>
    </motion.div>
  );
}

function SectionPlaceholder({ section }: { section: { title: string; description: string } }) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="panel empty-section"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="section-kicker">Coming next</p>
      <h2>{section.title}</h2>
      <span>{section.description}</span>
    </motion.section>
  );
}

function PlatformTab({
  isActive,
  onClick,
  platform,
}: {
  isActive: boolean;
  onClick: () => void;
  platform: PlatformOption;
}) {
  const platformColor = getPlatformColor(platform.id);

  return (
    <button
      aria-label={platform.label}
      aria-selected={isActive}
      className={isActive ? "platform-tab is-active" : "platform-tab"}
      data-platform={platform.id}
      onClick={onClick}
      role="tab"
      style={{ "--platform-color": platformColor } as CSSProperties}
      title={platform.label}
      type="button"
    >
      {platform.id === "all" ? <SocialLogoGroup /> : <SocialLogo platform={platform.id} />}
    </button>
  );
}
