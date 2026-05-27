// Roomix Platform Console — custom dark dropdown.
//
// Replaces native <select> elements (which inherit the OS chrome and
// look glaringly white on top of the dark Console). Renders an
// input-like trigger plus a portal-anchored list of options. ESC and
// outside-click close. Up/Down keys move the highlight; Enter picks
// the highlight. Disabled state is supported.

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components";

export interface ConsoleSelectOption<V extends string> {
  value: V;
  label: React.ReactNode;
  /** Optional small meta on the right side of the option row. */
  meta?: React.ReactNode;
  disabled?: boolean;
}

export interface ConsoleSelectProps<V extends string> {
  value: V;
  onChange: (next: V) => void;
  options: ConsoleSelectOption<V>[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Optional className appended to the trigger element. */
  className?: string;
  /** Optional inline style override. */
  style?: React.CSSProperties;
}

export function ConsoleSelect<V extends string>({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  disabled = false,
  ariaLabel,
  className = "",
  style,
}: ConsoleSelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  const current = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);
  const currentIndex = useMemo(() => options.findIndex((o) => o.value === value), [options, value]);

  // Position the popover anchored to the trigger.
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPopoverPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight(currentIndex >= 0 ? currentIndex : 0);
  }, [open, currentIndex]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => {
          let next = (h + 1) % options.length;
          // Skip disabled
          let guard = 0;
          while (options[next]?.disabled && guard < options.length) {
            next = (next + 1) % options.length;
            guard += 1;
          }
          return next;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => {
          let next = (h - 1 + options.length) % options.length;
          let guard = 0;
          while (options[next]?.disabled && guard < options.length) {
            next = (next - 1 + options.length) % options.length;
            guard += 1;
          }
          return next;
        });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const candidate = options[highlight];
        if (candidate && !candidate.disabled) {
          onChange(candidate.value);
          close();
          triggerRef.current?.focus();
        }
        return;
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, highlight, onChange, close]);

  const popover =
    open && popoverPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={listRef}
            className="pc-select-popover"
            role="listbox"
            id={`${id}-list`}
            style={{
              position: "fixed",
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
            }}
          >
            {options.map((opt, i) => {
              const active = opt.value === value;
              const hot = i === highlight;
              return (
                <div
                  key={String(opt.value)}
                  className={`pc-select-option ${active ? "active" : ""} ${hot ? "hot" : ""} ${opt.disabled ? "disabled" : ""}`}
                  role="option"
                  aria-selected={active}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    if (opt.disabled) return;
                    onChange(opt.value);
                    close();
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="pc-select-option-label">{opt.label}</span>
                  {opt.meta != null ? <span className="pc-select-option-meta">{opt.meta}</span> : null}
                  {active ? <Icon name="check" size={12} /> : null}
                </div>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`pc-select-trigger ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`}
        style={style}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="pc-select-value">
          {current ? current.label : <span className="muted">{placeholder}</span>}
        </span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={12} />
      </button>
      {popover}
    </>
  );
}
