import { Link } from "react-router-dom";
import "./StatCard.css";

function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  tone = "primary",
  subtitle,
  href,
  className = "",
  style,
  ...props
}) {
  const Component = href ? Link : "article";
  const destinationProps = href
    ? { to: href, "aria-label": "View " + label + ": " + value }
    : {};

  return (
    <Component
      className={
        "tmc-stat-card tmc-stat-card--" +
        tone +
        (href ? " tmc-stat-card--link" : "") +
        " " +
        className
      }
      style={style}
      {...destinationProps}
      {...props}
    >
      {Icon && (
        <span className="tmc-stat-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      )}
      <span className="tmc-stat-content">
        <span className="tmc-stat-label">{label}</span>
        <strong className="tmc-stat-value">{value}</strong>
        {subtitle && <span className="tmc-stat-subtitle">{subtitle}</span>}
      </span>
      {delta !== undefined && delta !== null && (
        <span className={"tmc-stat-delta " + (delta >= 0 ? "positive" : "negative")}>
          {delta >= 0 ? "+" : ""}{delta}
        </span>
      )}
      {href && <span className="tmc-stat-link" aria-hidden="true">→</span>}
    </Component>
  );
}

StatCard.displayName = "StatCard";

export default StatCard;
