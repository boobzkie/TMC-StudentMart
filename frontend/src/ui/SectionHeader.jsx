import "./SectionHeader.css";

function SectionHeader({ title, subtitle, action, actionLabel, actionVariant = "primary", className = "" }) {
  return (
    <div className={`tmc-section-header ${className}`.trim()}>
      <div>
        {title && <span className="tmc-section-eyebrow">{title}</span>}
        {subtitle && <h2 className="tmc-section-title">{subtitle}</h2>}
      </div>
      {action && actionLabel && (
        <button type="button" className={`tmc-btn tmc-btn--${actionVariant} tmc-btn--sm`} onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

SectionHeader.displayName = "SectionHeader";

export default SectionHeader;
