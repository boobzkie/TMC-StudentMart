import { AlertTriangle, Check, Trash2, X } from "lucide-react";
import "./ConfirmModal.css";

function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "primary",
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const Icon =
    type === "danger"
      ? Trash2
      : type === "warning"
        ? AlertTriangle
        : Check;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
    >
      <div className="confirm-modal">
        <button
          className="modal-close"
          onClick={onCancel}
          disabled={loading}
          aria-label="Close"
        >
          <X size={19} />
        </button>

        <div className={`modal-icon ${type}`}>
          <Icon size={23} />
        </div>

        <h2>{title}</h2>

        <p>{message}</p>

        <div className="modal-actions">
          <button
            className="modal-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>

          <button
            className={`modal-confirm ${type}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;