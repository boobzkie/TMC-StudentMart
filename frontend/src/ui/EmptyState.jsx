import "./EmptyState.css";

function EmptyState({ icon: Icon, title, subtitle, action, actionLabel, className = "" }) {
  return (
    <div className={`tmc-empty-state ${className}`.trim()}>
      {Icon && <div className="tmc-empty-state-icon"><Icon size={48} aria-hidden="true" /></div>}
      {title && <h2 className="tmc-empty-state-title">{title}</h2>}
      {subtitle && <p className="tmc-empty-state-subtitle">{subtitle}</p>}
      {action && actionLabel && (
        <button type="button" className="tmc-btn tmc-btn--primary tmc-btn--sm" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

EmptyState.displayName = "EmptyState";

export default EmptyState;
