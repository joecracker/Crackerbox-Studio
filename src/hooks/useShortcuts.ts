import { useEffect, useRef } from "react";

export interface ShortcutBinding {
  combo: string;
  handler: (e: KeyboardEvent) => void;
}

interface ParsedCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.split("+").map((p) => p.trim());
  return {
    ctrl: parts.includes("Ctrl"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
    key: parts[parts.length - 1].toLowerCase(),
  };
}

function matches(e: KeyboardEvent, combo: ParsedCombo): boolean {
  const ctrl = e.ctrlKey || e.metaKey;
  return (
    ctrl === combo.ctrl &&
    e.shiftKey === combo.shift &&
    e.altKey === combo.alt &&
    e.key.toLowerCase() === combo.key
  );
}

export function useShortcuts(enabled: boolean, bindings: ShortcutBinding[]) {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      for (const { combo, handler } of bindingsRef.current) {
        if (matches(e, parseCombo(combo))) {
          e.preventDefault();
          handler(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
