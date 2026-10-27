import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

export default function AdminPageHero({
  title,
  description,
  icon: Icon,
  onRefresh,
  refreshing = false,
  refreshDisabled = false,
  autoRefreshIntervalMs = 0,
  autoRefreshKey,
  autoRefreshPaused = false,
  refreshLabel,
  actions,
  meta,
  sideContent,
  className = "",
}) {
  const [requesting, setRequesting] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const busy = requesting || autoRefreshing || refreshing;
  const onRefreshRef = useRef(onRefresh);
  const refreshStateRef = useRef({ busy, refreshDisabled, autoRefreshPaused });
  const requestInFlightRef = useRef(false);
  const activeControllerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
    refreshStateRef.current = { busy, refreshDisabled, autoRefreshPaused };
  }, [onRefresh, busy, refreshDisabled, autoRefreshPaused]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
    };
  }, []);

  const runRefresh = useCallback(async (signal, automatic = false) => {
    const handler = onRefreshRef.current;
    if (!handler || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    if (automatic) setAutoRefreshing(true);
    else setRequesting(true);
    setRefreshError("");

    try {
      await handler(signal);
    } catch (error) {
      if (!signal?.aborted && mountedRef.current) {
        setRefreshError(error?.message || "Unable to refresh this page. Please try again.");
      }
    } finally {
      requestInFlightRef.current = false;
      if (mountedRef.current) {
        if (automatic) setAutoRefreshing(false);
        else setRequesting(false);
      }
    }
  }, []);

  const handleRefresh = async () => {
    if (!onRefresh || busy || refreshDisabled) return;
    await runRefresh();
  };

  useEffect(() => {
    if (!autoRefreshIntervalMs) return undefined;

    let active = true;
    let controller = null;

    const refreshWhenDue = async () => {
      const state = refreshStateRef.current;
      if (
        !active ||
        document.visibilityState !== "visible" ||
        state.busy ||
        state.refreshDisabled ||
        state.autoRefreshPaused ||
        requestInFlightRef.current ||
        !onRefreshRef.current
      ) return;

      controller = new AbortController();
      activeControllerRef.current = controller;
      await runRefresh(controller.signal, true);
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
      controller = null;
    };

    const pauseWhenHidden = () => {
      if (document.visibilityState !== "visible") controller?.abort();
    };

    const timer = window.setInterval(() => { void refreshWhenDue(); }, autoRefreshIntervalMs);
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      controller?.abort();
      if (activeControllerRef.current === controller) activeControllerRef.current = null;
    };
  }, [autoRefreshIntervalMs, autoRefreshKey, autoRefreshPaused, runRefresh]);

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
          <h1>{title}</h1>
          {description && <p>{description}</p>}
          {meta && <div className="admin-page-hero-meta">{meta}</div>}
        </div>
      </div>

      {sideContent && <div className="admin-page-hero-side">{sideContent}</div>}

      <div className="admin-page-hero-actions">
        {actions}
        {autoRefreshIntervalMs <= 0 && onRefresh && (
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
