import { usePersistentState } from "./usePersistentState";

const LAYOUT_KEY = "crackerbox.layout";

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 720;

export interface LayoutState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 320,
  sidebarCollapsed: false,
};

function clamp(n: number): number {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(n)));
}

export function useLayout() {
  const [layout, setLayout] = usePersistentState<LayoutState>(LAYOUT_KEY, DEFAULT_LAYOUT);

  const setSidebarWidth = (width: number) =>
    setLayout((prev) => ({ ...prev, sidebarWidth: clamp(width) }));

  const toggleSidebar = () =>
    setLayout((prev) => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));

  return {
    sidebarWidth: layout.sidebarWidth,
    sidebarCollapsed: layout.sidebarCollapsed,
    setSidebarWidth,
    toggleSidebar,
  };
}
