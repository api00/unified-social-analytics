import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompactNumber } from "../data/analytics";
import type { AudienceMixItem } from "../types/analytics";
import { getPlatformColor } from "../data/socials";
import SocialLogo from "./SocialLogo";

export default function PlatformBreakdown({ audienceMixData }: { audienceMixData: AudienceMixItem[] }) {
  const total = audienceMixData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="panel analytics-card platform-panel" aria-labelledby="platform-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Per-site split</p>
          <h2 id="platform-title">Audience growth</h2>
        </div>
        <strong>{formatCompactNumber(total)}</strong>
      </div>

      <div className="donut-wrap" role="img" aria-label="Donut chart showing audience growth by network">
        <ResponsiveContainer width="100%" height={238}>
          <PieChart>
            <Pie
              data={audienceMixData}
              dataKey="value"
              innerRadius={74}
              isAnimationActive={false}
              outerRadius={108}
              paddingAngle={3}
            >
              {audienceMixData.map((entry) => (
                <Cell fill={getPlatformColor(entry.name)} key={entry.name} />
              ))}
            </Pie>
            <Tooltip content={<AudienceTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span>Total</span>
          <strong>{formatCompactNumber(total)}</strong>
        </div>
      </div>

      <ul className="platform-list">
        {audienceMixData.map((item) => (
          <li key={item.name}>
            <SocialLogo platform={item.name} size={15} />
            <strong>{item.name}</strong>
            <em>{formatCompactNumber(item.value)}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AudienceTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: AudienceMixItem }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  const share = Math.round((item.value / total) * 100);

  return (
    <div className="chart-tooltip chart-tooltip--audience">
      <div className="tooltip-header">
        <div>
          <strong>Audience growth</strong>
          <span>{share}% of total</span>
        </div>
      </div>
      <div className="tooltip-row is-total">
        <SocialLogo platform={item.name} size={13} />
        <span className="tooltip-label">{item.name}</span>
        <strong>{formatCompactNumber(item.value)}</strong>
      </div>
    </div>
  );
}
