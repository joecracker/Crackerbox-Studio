import { useCallback, useRef, useState } from "react";

export interface PendingEdit {
  id: string;
  path: string;
  oldContent: string;
  newContent: string;
}

export function useEdits() {
  const [pending, setPending] = useState<PendingEdit[]>([]);
  const idRef = useRef(0);

  const proposeEdit = useCallback((path: string, newContent: string, oldContent: string) => {
    setPending((prev) => [
      ...prev,
      { id: String(++idRef.current), path, oldContent, newContent },
    ]);
  }, []);

  const rejectEdit = useCallback((id: string) => {
    setPending((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setPending([]);
  }, []);

  return { pending, proposeEdit, rejectEdit, clearAll };
}
