import "./Modal.css";

function Modal({ isOpen = false, onClose, className = "", title, children, confirmLabel, cancelLabel, onConfirm, loading, destructive }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="tmc-modal-overlay" onClick={onClose}>
        <div className={`tmc-modal ${className}`.trim()}>
          <div className="tmc-modal-header">
            <span className="tmc-modal-title">{title}</span>
            <button type="button" className="tmc-modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="tmc-modal-body">{children}</div>
          {confirmLabel && (
            <div className="tmc-modal-footer">
              <button type="button" className="tmc-btn tmc-btn--ghost tmc-btn--sm" onClick={onClose} disabled={loading}>
                {cancelLabel || "Cancel"}
              </button>
              <button type="button" className={`tmc-btn tmc-btn--${destructive ? "danger" : "primary"} tmc-btn--sm`} onClick={onConfirm} disabled={loading}>
                {loading ? <span className="tmc-btn-spinner" aria-hidden="true" /> : confirmLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

Modal.displayName = "Modal";

export default Modal;
