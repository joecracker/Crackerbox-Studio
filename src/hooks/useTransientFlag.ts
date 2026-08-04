import { useCallback, useEffect, useRef, useState } from "react";

export function useTransientFlag(ms = 200): [boolean, () => void] {
  const [flag, setFlag] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const trigger = useCallback(() => {
    setFlag(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlag(false), ms);
  }, [ms]);

  return [flag, trigger];
}
