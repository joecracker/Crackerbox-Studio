import { useEffect, useRef } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

interface PanelResizerProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  onResize: (width: number) => void;
}

export default function PanelResizer({ width, minWidth, maxWidth, onResize }: PanelResizerProps) {
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      document.body.classList.remove("resizing");
    },
    []
  );

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    dragState.current = { startX: e.clientX, startWidth: width };
    document.body.classList.add("resizing");

    const onMove = (ev: PointerEvent) => {
      if (!dragState.current) return;
      const next = dragState.current.startWidth + (ev.clientX - dragState.current.startX);
      const effectiveMax = Math.min(maxWidth, window.innerWidth - 260);
      onResize(Math.min(effectiveMax, Math.max(minWidth, next)));
    };

    const cleanup = () => {
      cleanupRef.current = null;
      dragState.current = null;
      document.body.classList.remove("resizing");
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", cleanup);
      el.removeEventListener("pointercancel", cleanup);
    };

    cleanupRef.current = cleanup;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", cleanup);
    el.addEventListener("pointercancel", cleanup);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = e.key === "ArrowLeft" ? -12 : e.key === "ArrowRight" ? 12 : 0;
    if (delta === 0) return;
    e.preventDefault();
    onResize(Math.min(maxWidth, Math.max(minWidth, width + delta)));
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={startDrag}
      onKeyDown={handleKeyDown}
      className="group relative w-1 shrink-0 cursor-col-resize bg-zinc-900 outline-none focus-visible:bg-sky-500 focus-visible:ring-1 focus-visible:ring-sky-400"
    >
      <span
        className="absolute inset-y-0 -left-0.5 -right-0.5 transition-colors group-hover:bg-sky-500/50"
        aria-hidden="true"
      />
    </div>
  );
}
