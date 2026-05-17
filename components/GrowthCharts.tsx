import {
  Area,
  Bar,
  BarChart,
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

const metricKeyByPlatform: Record<PlatformId, "total" | "youtube" | "tiktok" | "instagram"> = {
  all: "total",
  youtube: "youtube",
  tiktok: "tiktok",
  instagram: "instagram",
};

const seriesLabels: Record<string, string> = {
  total: "Total views",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  views: "Views",
};

const socialPlatformIds = new Set(["youtube", "tiktok", "instagram"]);

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

        <div className="chart-block" role="img" aria-label="Bar chart showing performance by content format">
          <ResponsiveContainer width="100%" height={318}>
            <BarChart data={contentByFormatData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 10 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="4 5" horizontal={false} />
              <XAxis
                axisLine={false}
                tick={axisStyle}
                tickFormatter={(value) => formatCompactNumber(value)}
                tickLine={false}
                type="number"
              />
              <YAxis dataKey="name" tick={axisStyle} type="category" tickLine={false} axisLine={false} width={92} />
              <Tooltip content={<FormatTooltip />} cursor={{ fill: "rgba(49, 91, 232, 0.06)" }} />
              <Bar
                background={{ fill: "#eef1f5", radius: 8 }}
                barSize={16}
                dataKey="views"
                fill={activeColor}
                isAnimationActive={false}
                name="Views"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
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

function FormatTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: ChartPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="chart-tooltip chart-tooltip--metric">
      <div className="tooltip-header">
        <div>
          <strong>{label}</strong>
          <span>Format demand</span>
        </div>
      </div>
      <div className="tooltip-row is-total">
        <span className="tooltip-total-mark" aria-hidden="true">
          <i style={{ "--tooltip-color": item.color } as CSSProperties} />
        </span>
        <span className="tooltip-label">{item.name}</span>
        <strong>{formatCompactNumber(Number(item.value ?? 0))}</strong>
      </div>
    </div>
  );
}
