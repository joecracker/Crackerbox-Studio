import { useCallback, useEffect, useRef, useState } from "react";
import { usePersistentState } from "./usePersistentState";

const TOOLBAR_KEY = "crackerbox.preview.toolbar.v2";
const HIDE_DELAY_MS = 1600;

interface ToolbarPrefs {
  autoHide: boolean;
  pinned: boolean;
}

export function usePreviewToolbar() {
  const [prefs, setPrefs] = usePersistentState<ToolbarPrefs>(TOOLBAR_KEY, {
    autoHide: false,
    pinned: false,
  });
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  const autoHide = prefs.autoHide;
  const pinned = prefs.pinned;
  const showAlways = !autoHide || pinned;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (autoHide && !pinned) setVisible(false);
    }, HIDE_DELAY_MS);
  }, [autoHide, pinned, clearTimer]);

  useEffect(() => {
    clearTimer();
    if (showAlways) setVisible(true);
    else setVisible(false);
  }, [showAlways, clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const handlePointerEnter = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const handlePointerLeave = useCallback(() => {
    clearTimer();
    if (autoHide && !pinned) setVisible(false);
  }, [autoHide, pinned, clearTimer]);

  const setAutoHide = useCallback(
    (value: boolean) => setPrefs((prev) => ({ ...prev, autoHide: value })),
    [setPrefs]
  );

  const setPinned = useCallback(
    (value: boolean) => setPrefs((prev) => ({ ...prev, pinned: value })),
    [setPrefs]
  );

  return {
    autoHide,
    pinned,
    setAutoHide,
    setPinned,
    visible: showAlways || visible,
    handlePointerEnter,
    handlePointerLeave,
  };
}