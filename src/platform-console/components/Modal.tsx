// Generic modal shell used by the Platform Console interactions
// (open property, new property, demo property, profile dropdown
// settings sub-screens, …).
//
// Behavior:
//   • ESC closes.
//   • Clicking the backdrop closes (configurable).
//   • Focus traps inside the dialog when open (rough — first focusable).
//   • Auto-portals to document.body so it never gets clipped by parent
//     overflow.

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  icon?: string;
  /** Default 560px. Pass "lg" for 720, "xl" for 880, "2xl" for 1100,
   *  "full" for ~96vw, or a CSS string. */
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | string;
  /** Set false to disable closing by clicking the backdrop. */
  closeOnBackdrop?: boolean;
  /** Right-aligned secondary content in the header. */
  headerActions?: React.ReactNode;
  /** Footer slot — usually the action buttons. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

const widthFor = (w: ModalProps["width"]) => {
  if (typeof w === "string" && !["sm", "md", "lg", "xl", "2xl", "full"].includes(w)) return w;
  switch (w) {
    case "sm":
      return "420px";
    case "lg":
      return "720px";
    case "xl":
      return "880px";
    case "2xl":
      return "1100px";
    case "full":
      return "min(96vw, 1280px)";
    default:
      return "560px";
  }
};

export function Modal({
  open,
  onClose,
  title,
  sub,
  icon,
  width = "md",
  closeOnBackdrop = true,
  headerActions,
  footer,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Stable ref so the ESC handler effect does not need to re-bind
  // (and re-fire the focus side-effect) every time the parent passes
  // a new `onClose` closure. This was the root cause of the
  // "Backspace steals focus" bug: handleClose was recreated on every
  // keystroke → ESC effect re-ran → focus jumped back to the first
  // `[data-autofocus]` input after 40ms.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ESC key handler — depends only on `open`.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-focus — runs ONLY when modal transitions to open. Subsequent
  // re-renders of the parent (every keystroke in any field) must NOT
  // re-focus, otherwise the operator loses the caret on Backspace /
  // Delete pauses.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      // Skip if the operator is already typing inside the dialog —
      // never override an active edit.
      const active = document.activeElement as HTMLElement | null;
      if (active && dialogRef.current?.contains(active)) return;
      const first = dialogRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, button, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      first?.focus();
    }, 40);
    return () => clearTimeout(t);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pc-modal-backdrop"
      onClick={() => closeOnBackdrop && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="pc-modal"
        style={{ width: widthFor(width) }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pc-modal-title"
      >
        <div className="pc-modal-head">
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            {icon && (
              <div className="pc-modal-icon">
                <Icon name={icon} size={14} />
              </div>
            )}
            <div>
              <div id="pc-modal-title" className="pc-modal-title">
                {title}
              </div>
              {sub && <div className="pc-modal-sub">{sub}</div>}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {headerActions}
            <button
              type="button"
              className="pc-modal-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        </div>

        <div className="pc-modal-body">{children}</div>

        {footer && <div className="pc-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
