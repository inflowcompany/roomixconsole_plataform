// Roomix Platform Console — custom date/time picker.
//
// Why not the native <input type="datetime-local">?
//   1. The native control's calendar popup uses the OS chrome (light
//      mode on Windows, weird popovers on Safari, etc.) — it never
//      matches the Linear-inspired dark surface system the rest of
//      the Console uses.
//   2. It also has unreliable z-index behaviour inside modals on
//      Chromium and breaks the eyebrow-label hierarchy used by the
//      .pc-field-* tokens.
//
// This component renders:
//   • A trigger button that looks like .pc-field-input (same surface,
//     same hairline border, same focus ring).
//   • A portaled popover with a hand-rolled calendar grid + HH:mm
//     spinners. Portals to document.body so it never gets clipped by
//     a parent overflow / modal.
//
// Output is always an ISO string (or empty string for "no value")
// trimmed to second precision. The caller manages the state — this
// component is fully controlled.

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components";

export interface DateTimePickerProps {
  /** Controlled ISO value (e.g. "2026-05-26T14:30:00.000Z"). Empty string means "no value". */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  /** Disable the trigger (e.g. while loading). */
  disabled?: boolean;
  /** Aria-label for the trigger. */
  ariaLabel?: string;
}

const MONTH_LABELS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAY_LABELS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function buildCalendar(viewYear: number, viewMonth: number): CalendarCell[] {
  // Build a 6×7 grid of dates that always starts on Sunday.
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const start = new Date(viewYear, viewMonth, 1 - startWeekday);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === viewMonth });
  }
  return cells;
}

function clampHour(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(23, Math.floor(n)));
}

function clampMinute(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(59, Math.floor(n)));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDisplay(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} · ${hh}:${min}`;
}

export function DateTimePicker({ value, onChange, placeholder = "—", disabled, ariaLabel }: DateTimePickerProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const parsedValue = useMemo<Date | null>(() => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value]);

  const today = useMemo(() => new Date(), []);
  const baseForView = parsedValue || today;
  const [viewYear, setViewYear] = useState(baseForView.getFullYear());
  const [viewMonth, setViewMonth] = useState(baseForView.getMonth());

  // Sync internal view to the value whenever it changes externally.
  useEffect(() => {
    if (parsedValue) {
      setViewYear(parsedValue.getFullYear());
      setViewMonth(parsedValue.getMonth());
    }
  }, [parsedValue]);

  const positionPopover = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const popH = 380; // approx popover height
    const popW = Math.max(r.width, 300);
    // Prefer below trigger; flip above if there's no room.
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow >= popH + 16 ? r.bottom + 6 : Math.max(8, r.top - popH - 6);
    let left = r.left;
    if (left + popW > window.innerWidth - 12) left = window.innerWidth - popW - 12;
    if (left < 12) left = 12;
    setPosition({ top, left, width: popW });
  }, []);

  useLayoutEffect(() => {
    if (open) positionPopover();
  }, [open, positionPopover]);

  // Reposition on scroll / resize while open.
  useEffect(() => {
    if (!open) return;
    const handler = () => positionPopover();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, positionPopover]);

  // Outside click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const cells = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth]);

  const emit = useCallback(
    (date: Date, hour: number, minute: number) => {
      const d = new Date(date);
      d.setHours(clampHour(hour), clampMinute(minute), 0, 0);
      onChange(d.toISOString());
    },
    [onChange],
  );

  const handlePickDate = useCallback(
    (cell: CalendarCell) => {
      const base = parsedValue ?? new Date();
      emit(cell.date, base.getHours(), base.getMinutes());
    },
    [emit, parsedValue],
  );

  const handleHour = useCallback(
    (h: number) => {
      const base = parsedValue ?? new Date();
      emit(base, h, base.getMinutes());
    },
    [emit, parsedValue],
  );

  const handleMinute = useCallback(
    (m: number) => {
      const base = parsedValue ?? new Date();
      emit(base, base.getHours(), m);
    },
    [emit, parsedValue],
  );

  const goPrevMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    emit(now, now.getHours(), now.getMinutes());
  }, [emit]);

  const handleClear = useCallback(() => {
    onChange("");
    setOpen(false);
  }, [onChange]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="pc-field-input pc-dtp-trigger"
        style={{
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={{ color: parsedValue ? "#ECF0F5" : "#5C6675", fontVariantNumeric: "tabular-nums" }}>
          {parsedValue ? formatDisplay(parsedValue) : placeholder}
        </span>
        <Icon name="calendar" size={13} color="var(--text-mute)" />
      </button>

      {open && position && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Selecionar data e hora"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              minWidth: position.width,
              zIndex: 240,
              background: "#10151B",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              boxShadow: "0 24px 48px -16px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4)",
              padding: 12,
              color: "#C7CFD9",
              fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
              animation: "pc-fadein 90ms",
            }}
          >
            {/* Header: prev / month label / next */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button type="button" onClick={goPrevMonth} className="icon-btn" title="Mês anterior">
                <Icon name="chevron-left" size={13} />
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#ECF0F5", fontWeight: 500 }}>
                <span>{MONTH_LABELS_PT[viewMonth]}</span>
                <span style={{ color: "#5C6675" }}>{viewYear}</span>
              </div>
              <button type="button" onClick={goNextMonth} className="icon-btn" title="Próximo mês">
                <Icon name="chevron-right" size={13} />
              </button>
            </div>

            {/* Weekday header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {WEEKDAY_LABELS_PT.map((w) => (
                <div
                  key={w}
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    color: "#5C6675",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    padding: "4px 0",
                  }}
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {cells.map((cell, i) => {
                const isToday = sameDay(cell.date, today);
                const isSelected = parsedValue ? sameDay(cell.date, parsedValue) : false;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePickDate(cell)}
                    style={{
                      padding: "7px 0",
                      borderRadius: 6,
                      border: "1px solid transparent",
                      background: isSelected
                        ? "rgba(24,211,154,0.18)"
                        : isToday
                          ? "rgba(255,255,255,0.05)"
                          : "transparent",
                      color: isSelected
                        ? "#18D39A"
                        : cell.inMonth
                          ? "#C7CFD9"
                          : "#3A434F",
                      fontSize: 11.5,
                      fontWeight: isSelected ? 600 : 400,
                      fontFamily: "'Geist Mono', ui-monospace, monospace",
                      cursor: "pointer",
                      transition: "background 100ms",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isToday ? "rgba(255,255,255,0.05)" : "transparent";
                      }
                    }}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Time pickers */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 10,
              }}
            >
              <Icon name="clock" size={13} color="var(--text-mute)" />
              <select
                aria-label="Hora"
                value={parsedValue ? parsedValue.getHours() : 0}
                onChange={(e) => handleHour(Number(e.target.value))}
                className="pc-field-input"
                style={{ width: 72, padding: "6px 8px", fontSize: 12 }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <span style={{ color: "#5C6675" }}>:</span>
              <select
                aria-label="Minuto"
                value={parsedValue ? parsedValue.getMinutes() : 0}
                onChange={(e) => handleMinute(Number(e.target.value))}
                className="pc-field-input"
                style={{ width: 72, padding: "6px 8px", fontSize: 12 }}
              >
                {Array.from({ length: 60 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={handleClear}
                  className="btn ghost"
                  style={{ fontSize: 11, padding: "5px 9px" }}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="btn ghost"
                  style={{ fontSize: 11, padding: "5px 9px" }}
                >
                  Agora
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
