import { formatCompactNumber } from "../data/analytics";
import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  delta,
  icon: Icon,
  label,
  textValue = false,
  value,
}: {
  delta: string;
  icon: LucideIcon;
  label: string;
  textValue?: boolean;
  value: number | string;
}) {
  const renderedValue = textValue ? value : formatCompactNumber(Number(value));

  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <span className="metric-icon" aria-hidden="true">
          <Icon size={15} />
        </span>
        <p>{label}</p>
      </div>
      <strong>{renderedValue}</strong>
      <div className="metric-card-footer">
        {delta ? <span>{delta}</span> : null}
        <small>vs prior week</small>
      </div>
    </article>
  );
}
