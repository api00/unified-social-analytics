import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CSSProperties } from "react";
import { formatCompactNumber } from "../data/analytics";
import { getPlatformColor, getPlatformId, isSocialPlatformId } from "../data/socials";
import type { ContentFormatDatum, DataSource, PlatformId, WeeklySeriesPoint } from "../types/analytics";
import SocialLogo from "./SocialLogo";

const axisStyle = { fill: "#647085", fontSize: 11, fontFamily: "var(--font-instrument-sans)" };
const gridColor = "#e6e9ee";
const accentColor = "#315be8";

const metricKeyByPlatform: Record<PlatformId, "total" | "youtube" | "tiktok" | "instagram" | "x"> = {
  all: "total",
  youtube: "youtube",
  tiktok: "tiktok",
  instagram: "instagram",
  x: "x",
};

const seriesLabels: Record<string, string> = {
  total: "Total views",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  views: "Views",
};

const socialPlatformIds = new Set(["youtube", "tiktok", "instagram", "x"]);

export default function GrowthCharts({
  activePlatform,
  contentByFormatData,
  source,
  weeklySeriesData,
}: {
  activePlatform: PlatformId;
  contentByFormatData: ContentFormatDatum[];
  source: DataSource;
  weeklySeriesData: WeeklySeriesPoint[];
}) {
  const activeKey = metricKeyByPlatform[activePlatform] ?? "total";
  const showAllSeries = activePlatform === "all";
  const activeColor = activePlatform === "all" ? accentColor : getPlatformColor(activePlatform);

  return (
    <>
      <section className="panel analytics-card trend-card" aria-labelledby="growth-title">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Performance trend</p>
            <h2 id="growth-title">Daily views</h2>
          </div>
          <span className="panel-meta">{source === "live" ? "Live data" : "—"}</span>
        </div>

        <div className="chart-block" role="img" aria-label="Area chart showing daily views by selected platform">
          <ResponsiveContainer width="100%" height={318}>
            <ComposedChart data={weeklySeriesData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={activeColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={activeColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={gridColor} strokeDasharray="4 5" vertical={false} />
              <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={false} />
              <YAxis
                axisLine={false}
                tick={axisStyle}
                tickFormatter={(value) => formatCompactNumber(value)}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ViewsTooltip />} cursor={{ stroke: "#aeb7c5", strokeDasharray: "3 3" }} />
              <Legend
                align="left"
                iconType="circle"
                wrapperStyle={{ color: "#647085", fontSize: 12, paddingTop: 8 }}
                formatter={(value) => seriesLabels[value] ?? value}
              />
              <Area
                dataKey={activeKey}
                fill="url(#viewsGradient)"
                isAnimationActive={false}
                name={seriesLabels[activeKey]}
                stroke={activeColor}
                strokeWidth={2.75}
                type="monotone"
              />
              {showAllSeries ? (
                <>
                  <Line dataKey="youtube" dot={false} isAnimationActive={false} stroke={getPlatformColor("youtube")} strokeWidth={1.7} type="monotone" />
                  <Line dataKey="x" dot={false} isAnimationActive={false} stroke={getPlatformColor("x")} strokeWidth={1.7} type="monotone" />
                  <Line dataKey="tiktok" dot={false} isAnimationActive={false} stroke={getPlatformColor("tiktok")} strokeWidth={1.7} type="monotone" />
                  <Line dataKey="instagram" dot={false} isAnimationActive={false} stroke={getPlatformColor("instagram")} strokeWidth={1.7} type="monotone" />
                </>
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="panel analytics-card format-card" aria-labelledby="format-title">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">Format demand</p>
            <h2 id="format-title">Views by content type</h2>
          </div>
          <span className="panel-meta">{source === "live" ? "Live data" : "—"}</span>
        </div>

        <FormatBreakdown data={contentByFormatData} color={activeColor} />
      </section>
    </>
  );
}

function FormatBreakdown({ data, color }: { data: ContentFormatDatum[]; color: string }) {
  const sorted = [...data].sort((a, b) => b.views - a.views);

  if (!sorted.length) {
    return (
      <div className="format-empty" role="status">
        <strong>Not enough data yet</strong>
        <small>Once you have synced views, formats will appear here.</small>
      </div>
    );
  }

  const max = Math.max(...sorted.map((item) => item.views), 1);

  return (
    <ul className="format-list" aria-label="Views by content format">
      {sorted.map((item) => {
        const widthPct = Math.max(6, Math.round((item.views / max) * 100));
        return (
          <li className="format-row" key={item.name}>
            <span className="format-name">{item.name}</span>
            <span className="format-bar" aria-hidden="true">
              <span
                className="format-bar-fill"
                style={{ "--bar-color": color, "--bar-width": `${widthPct}%` } as CSSProperties}
              />
            </span>
            <strong className="format-value">{formatCompactNumber(item.views)}</strong>
          </li>
        );
      })}
    </ul>
  );
}

type ChartPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string;
  value?: number;
  payload?: Record<string, unknown>;
};

function ViewsTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: ChartPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip chart-tooltip--views">
      <div className="tooltip-header">
        <div>
          <strong>{label}</strong>
          <span>Views by network</span>
        </div>
      </div>

      <div className="tooltip-list">
        {payload.map((item) => {
          const dataKey = String(item.dataKey ?? "");
          const platformId = getPlatformId(dataKey);
          const isSocialPlatform = isSocialPlatformId(platformId) && socialPlatformIds.has(platformId);

          return (
            <div className={dataKey === "total" ? "tooltip-row is-total" : "tooltip-row"} key={dataKey}>
              {isSocialPlatform ? (
                <SocialLogo platform={platformId} size={13} />
              ) : (
                <span className="tooltip-total-mark" aria-hidden="true">
                  <i style={{ "--tooltip-color": item.color } as CSSProperties} />
                </span>
              )}
              <span className="tooltip-label">{seriesLabels[dataKey] ?? item.name}</span>
              <strong>{formatCompactNumber(Number(item.value ?? 0))}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

