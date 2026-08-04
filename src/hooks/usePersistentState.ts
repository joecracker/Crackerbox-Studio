import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export function usePersistentState<T extends object>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      return { ...initialValue, ...(JSON.parse(raw) as T) };
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable (private mode, etc.)
      }
    }, 200);
    return () => window.clearTimeout(id);
  }, [key, value]);

  return [value, setValue];
}
