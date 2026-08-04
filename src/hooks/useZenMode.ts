import { useCallback, useEffect, useState } from "react";

export function useZenMode() {
  const [zen, setZen] = useState(false);

  const enterZen = useCallback(() => setZen(true), []);
  const exitZen = useCallback(() => setZen(false), []);
  const toggleZen = useCallback(() => setZen((v) => !v), []);

  useEffect(() => {
    if (!zen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zen]);

  return { zen, enterZen, exitZen, toggleZen };
}
