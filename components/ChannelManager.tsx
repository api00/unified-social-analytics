"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Plus,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getSocialBrand, socialBrandList, socialBrands } from "../data/socials";
import type { ChannelAccount, SocialPlatformId } from "../types/analytics";
import SocialLogo from "./SocialLogo";

type ChannelManagerProps = {
  isAuthenticated: boolean;
  onChannelsChange?: (count: number) => void;
};

export default function ChannelManager({ isAuthenticated, onChannelsChange }: ChannelManagerProps) {
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatformId>("youtube");
  const [channels, setChannels] = useState<ChannelAccount[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    async function loadChannels() {
      const response = await fetch("/api/channels");
      if (!response.ok) return;
      const payload = (await response.json()) as { channels?: ChannelAccount[] };
      const list = payload.channels ?? [];
      setChannels(list);
      onChannelsChange?.(list.length);
    }

    void loadChannels();
  }, [isAuthenticated, onChannelsChange]);

  async function connectSelectedPlatform() {
    setStatusMessage("");

    if (selectedPlatform !== "youtube") {
      setStatusMessage(`${socialBrands[selectedPlatform].label} connection is planned after YouTube.`);
      return;
    }

    const response = await fetch("/api/youtube/connect");
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      setStatusMessage(payload.error ?? "YouTube connection is not configured yet.");
      return;
    }

    window.location.href = payload.url;
  }

  async function syncNow() {
    setStatusMessage("");
    setIsSyncing(true);
    const response = await fetch("/api/youtube/sync", { method: "POST" });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; synced?: number };
    setIsSyncing(false);

    if (!response.ok) {
      setStatusMessage(payload.error ?? "Sync failed.");
      return;
    }

    setStatusMessage(`Synced ${payload.synced ?? 0} YouTube channel${payload.synced === 1 ? "" : "s"}.`);
  }

  const stats = buildChannelStats(channels);

  return (
    <>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="workspace-stack"
        initial={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="channel-hero panel" aria-labelledby="channels-title">
          <div>
            <p className="section-kicker">Channel manager</p>
            <h2 id="channels-title">Connect every social account in one place</h2>
            <span>Manage sync health, posting sources, and account access before analytics roll into the dashboard.</span>
          </div>
          <button className="primary-button" onClick={() => setIsAddingChannel(true)} type="button">
            <Plus size={16} />
            Add channel
          </button>
        </section>

        {statusMessage ? <p className="sync-note" role="status">{statusMessage}</p> : null}

        <section className="channel-stat-grid" aria-label="Channel setup summary">
          {stats.map((stat) => (
            <article className="channel-stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </section>

        <section className="channel-layout" aria-label="Channel management">
          <div className="panel channel-table-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Connected accounts</p>
                <h2>Active channels</h2>
              </div>
              <button className="secondary-button compact" type="button" onClick={syncNow} disabled={isSyncing || channels.length === 0}>
                <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
                {isSyncing ? "Syncing" : "Sync all"}
              </button>
            </div>

            {channels.length === 0 ? (
              <div className="channel-empty">
                <span className="channel-empty-icon" aria-hidden="true">
                  <RadioTower size={22} />
                </span>
                <strong>No channels connected yet</strong>
                <small>Add YouTube to start syncing views, audience, and top posts.</small>
                <button className="primary-button" type="button" onClick={() => setIsAddingChannel(true)}>
                  <Plus size={16} />
                  Add channel
                </button>
              </div>
            ) : (
              <div className="channel-list" role="list">
                {channels.map((channel) => (
                  <article className="channel-row" key={channel.id} role="listitem">
                    <div className="channel-identity">
                      <SocialLogo platform={channel.platform} size={14} />
                      <div>
                        <strong>{channel.name}</strong>
                        <small>
                          {getSocialBrand(channel.platform)?.label ?? "YouTube"} / {channel.handle}
                        </small>
                      </div>
                    </div>
                    <span className={channel.status === "Synced" ? "sync-badge is-healthy" : "sync-badge is-warning"}>
                      {channel.status === "Synced" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      {channel.status}
                    </span>
                    <span className="channel-meta">
                      <Clock3 size={13} />
                      {channel.cadence}
                    </span>
                    <strong className="channel-number">{channel.posts}</strong>
                    <strong className="channel-number">{channel.reach}</strong>
                    <button className="icon-button channel-menu-button" aria-label={`More options for ${channel.name}`} type="button">
                      <MoreHorizontal size={16} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </motion.div>

      <AnimatePresence>
        {isAddingChannel ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="dialog-backdrop"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="presentation"
          >
            <motion.section
              aria-labelledby="add-channel-title"
              aria-modal="true"
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="add-channel-dialog"
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              role="dialog"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="dialog-heading">
                <div>
                  <p className="section-kicker">New connection</p>
                  <h2 id="add-channel-title">Add channel</h2>
                </div>
                <button className="icon-button" onClick={() => setIsAddingChannel(false)} type="button" aria-label="Close add channel">
                  <X size={17} />
                </button>
              </div>

              <div className="platform-choice-grid" aria-label="Choose platform">
                {socialBrandList.map((platform) => (
                  <button
                    className={selectedPlatform === platform ? "platform-choice is-selected" : "platform-choice"}
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    type="button"
                  >
                    <SocialLogo platform={platform} size={18} />
                    <strong>{socialBrands[platform].label}</strong>
                    <small>{platform === "youtube" ? "Import channel, videos, and analytics" : "Coming after YouTube v1"}</small>
                  </button>
                ))}
              </div>

              <div className="permission-panel">
                <ShieldCheck size={18} aria-hidden="true" />
                <div>
                  <strong>Permissions preview</strong>
                  <span>Read-only access for analytics, post history, comments totals, and audience growth.</span>
                </div>
              </div>

              <div className="dialog-actions">
                <button className="secondary-button" onClick={() => setIsAddingChannel(false)} type="button">
                  Cancel
                </button>
                <button className="primary-button" type="button" onClick={connectSelectedPlatform}>
                  <ExternalLink size={16} />
                  Connect {socialBrands[selectedPlatform].label}
                </button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function buildChannelStats(channels: ChannelAccount[]) {
  const total = channels.length;
  const healthy = channels.filter((channel) => channel.status === "Synced").length;
  const needsReview = total - healthy;

  return [
    {
      label: "Connected channels",
      value: String(total),
      detail: total ? `${total} active` : "Nothing connected yet",
    },
    {
      label: "Healthy syncs",
      value: String(healthy),
      detail: needsReview ? `${needsReview} need${needsReview === 1 ? "s" : ""} review` : "All healthy",
    },
    {
      label: "Pending sync",
      value: String(total - healthy),
      detail: total ? "Will run on next cron" : "—",
    },
  ];
}
