import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  separatorBefore?: boolean;
  run: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      x: Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)),
      y: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
    });
  }, [x, y]);

  useEffect(() => {
    const previous = document.activeElement;
    menuRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>("[data-menu-item]") ?? [],
      );
      if (buttons.length === 0) return;
      const idx = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        idx < 0
          ? e.key === "ArrowDown"
            ? 0
            : buttons.length - 1
          : e.key === "ArrowDown"
            ? (idx + 1) % buttons.length
            : (idx - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={menuRef}
        role="menu"
        aria-label="Context menu"
        tabIndex={-1}
        style={{ left: position.x, top: position.y }}
        className="fixed w-64 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 py-1.5 shadow-2xl outline-none"
      >
        {items.map((item) => (
          <div key={item.id}>
            {item.separatorBefore && <div className="mx-2 my-1 border-t border-zinc-800" />}
            <button
              type="button"
              role="menuitem"
              data-menu-item
              onClick={() => {
                item.run();
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:bg-zinc-800 focus-visible:text-zinc-100"
            >
              <span className="truncate">{item.label}</span>
              {item.shortcut && (
                <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
