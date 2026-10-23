import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function AdminPageHero({
  title,
  icon: Icon,
  onRefresh,
  refreshing = false,
  refreshDisabled = false,
  refreshLabel,
  actions,
  meta,
  sideContent,
  className = "",
}) {
  const [requesting, setRequesting] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const busy = requesting || refreshing;

  const handleRefresh = async () => {
    if (!onRefresh || busy || refreshDisabled) return;
    setRequesting(true);
    setRefreshError("");
    try {
      await onRefresh();
    } catch (error) {
      setRefreshError(error?.message || "Unable to refresh this page. Please try again.");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <section
      className={[
        "admin-page-hero",
        sideContent ? "admin-page-hero-with-side" : "",
        className,
      ].filter(Boolean).join(" ")}
      aria-label={`${title} page header`}
    >
      <div className="admin-page-hero-main">
        {Icon && (
          <span className="admin-page-hero-icon" aria-hidden="true">
            <Icon size={30} strokeWidth={1.9} />
          </span>
        )}
        <div className="admin-page-hero-copy">
          <h2>{title}</h2>
          {meta && <div className="admin-page-hero-meta">{meta}</div>}
        </div>
      </div>

      {sideContent && <div className="admin-page-hero-side">{sideContent}</div>}

      <div className="admin-page-hero-actions">
        {actions}
        {onRefresh && (
          <button
            type="button"
            className="admin-page-hero-refresh"
            onClick={handleRefresh}
            disabled={busy || refreshDisabled}
            aria-label={refreshLabel || `Refresh ${title}`}
            aria-busy={busy}
            title={refreshDisabled ? "Save or discard your changes before refreshing." : undefined}
          >
            <RefreshCw size={17} className={busy ? "admin-page-hero-spin" : undefined} aria-hidden="true" />
            <span>{busy ? "Refreshing…" : "Refresh"}</span>
          </button>
        )}
      </div>

      {refreshError && <p className="admin-page-hero-error" role="alert">{refreshError}</p>}
    </section>
  );
}
