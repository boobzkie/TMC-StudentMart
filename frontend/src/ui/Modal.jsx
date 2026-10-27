import { useEffect, useRef } from "react";
import "./Modal.css";

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function useDialogBehavior({ isOpen, isActive, dialogRef, onClose, triggerRef, initialFocusSelector, fallbackFocusSelector }) {
  const closeHandlerRef = useRef(onClose);

  useEffect(() => {
    closeHandlerRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const triggerElement = triggerRef?.current;
    const previouslyFocused = triggerElement || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const target = dialog?.querySelector(initialFocusSelector) || dialog;
      target?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        const target = triggerElement?.isConnected
          ? triggerElement
          : previouslyFocused?.isConnected
            ? previouslyFocused
            : null;
        if (target) {
          target.focus({ preventScroll: true });
          return;
        }
        if (fallbackFocusSelector) {
          document.querySelector(fallbackFocusSelector)?.focus({ preventScroll: true });
        }
      });
    };
  }, [dialogRef, fallbackFocusSelector, initialFocusSelector, isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen || !isActive) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeHandlerRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogRef, isActive, isOpen]);
}

function Modal({
  isOpen = false,
  onClose,
  className = "tmc-modal",
  overlayClassName = "tmc-modal-overlay",
  title,
  titleId = "tmc-modal-title",
  descriptionId,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading,
  destructive,
  isActive = true,
  triggerRef,
  initialFocusSelector = "[data-modal-initial-focus], [data-modal-close]",
  fallbackFocusSelector,
  unstyled = false,
  closeOnBackdrop = true,
}) {
  const dialogRef = useRef(null);

  useDialogBehavior({ isOpen, isActive, dialogRef, onClose, triggerRef, initialFocusSelector, fallbackFocusSelector });

  if (!isOpen) return null;

  const handleBackdropMouseDown = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
  };

  return (
    <div className={overlayClassName} role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className={className}
        role="dialog"
        aria-modal={isActive}
        aria-hidden={isActive ? undefined : "true"}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={loading || undefined}
        tabIndex={-1}
      >
        {unstyled ? children : <>
          <div className="tmc-modal-header">
            <span className="tmc-modal-title" id={titleId}>{title}</span>
            <button type="button" className="tmc-modal-close" data-modal-close onClick={onClose} aria-label="Close">
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
        </>}
      </section>
    </div>
  );
}

Modal.displayName = "Modal";

export default Modal;
