import { usePersistentState } from "./usePersistentState";

const LAYOUT_KEY = "crackerbox.layout";

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 720;

export const PREVIEW_MIN_RATIO = 0.4;
export const PREVIEW_MAX_RATIO = 0.66;
export const PREVIEW_DEFAULT_RATIO = 0.5;

export const previewMinWidth = () => Math.round(window.innerWidth * PREVIEW_MIN_RATIO);
export const previewMaxWidth = () => Math.round(window.innerWidth * PREVIEW_MAX_RATIO);

export interface LayoutState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  previewWidth: number;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 320,
  sidebarCollapsed: false,
  previewWidth: Math.round(window.innerWidth * PREVIEW_DEFAULT_RATIO),
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function useLayout() {
  const [layout, setLayout] = usePersistentState<LayoutState>(LAYOUT_KEY, DEFAULT_LAYOUT);

  const setSidebarWidth = (width: number) =>
    setLayout((prev) => ({ ...prev, sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }));

  const toggleSidebar = () =>
    setLayout((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));

  const setPreviewWidth = (width: number) =>
    setLayout((prev) => ({
      ...prev,
      previewWidth: clamp(width, previewMinWidth(), previewMaxWidth()),
    }));

  return {
    sidebarWidth: layout.sidebarWidth,
    sidebarCollapsed: layout.sidebarCollapsed,
    setSidebarWidth,
    toggleSidebar,
    previewWidth: clamp(layout.previewWidth, previewMinWidth(), previewMaxWidth()),
    setPreviewWidth,
    previewMinWidth,
    previewMaxWidth,
  };
}
