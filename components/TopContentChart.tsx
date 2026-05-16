import type { CSSProperties } from "react";
import { formatCompactNumber } from "../data/analytics";
import { getPlatformColor } from "../data/socials";
import type { TopContentItem } from "../types/analytics";
import SocialLogo from "./SocialLogo";

export default function TopContentChart({ items }: { items: TopContentItem[] }) {
  const maxViews = Math.max(...items.map((item) => item.views));

  return (
    <section className="panel analytics-card top-content-chart" aria-labelledby="top-content-chart-title">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Content lift</p>
          <h2 id="top-content-chart-title">Top posts by views</h2>
        </div>
        <span className="panel-meta">Ranked</span>
      </div>

      <div className="ranked-list" role="list" aria-label="Top-performing posts ranked by views">
        {items.map((item, index) => (
          <article className="ranked-row" key={item.id} role="listitem">
            <div className="ranked-meta">
              <span className="ranked-index">{String(index + 1).padStart(2, "0")}</span>
              <SocialLogo platform={item.platform} size={13} />
              <div>
                <strong>{item.title}</strong>
                <small>{item.platform} / {item.type}</small>
              </div>
            </div>
            <div className="ranked-bar" aria-hidden="true">
              <span
                style={{
                  "--bar-color": getPlatformColor(item.platform),
                  "--bar-width": `${Math.max(18, Math.round((item.views / maxViews) * 100))}%`,
                } as CSSProperties}
              />
            </div>
            <strong className="ranked-value">{formatCompactNumber(item.views)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
