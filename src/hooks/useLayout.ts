import { usePersistentState } from "./usePersistentState";

const LAYOUT_KEY = "crackerbox.layout";

export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 720;

export const FILE_TREE_MIN = 180;
export const FILE_TREE_MAX = 480;

export const PREVIEW_MIN_RATIO = 0.4;
export const PREVIEW_MAX_RATIO = 0.66;
export const PREVIEW_DEFAULT_RATIO = 0.5;

export const TERMINAL_MIN = 120;
export const TERMINAL_MAX = 600;
export const TERMINAL_DEFAULT = 220;

export const previewMinWidth = () => Math.round(window.innerWidth * PREVIEW_MIN_RATIO);
export const previewMaxWidth = () => Math.round(window.innerWidth * PREVIEW_MAX_RATIO);

export interface LayoutState {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  previewWidth: number;
  previewCollapsed: boolean;
  fileTreeWidth: number;
  fileTreeCollapsed: boolean;
  terminalOpen: boolean;
  terminalHeight: number;
}

const DEFAULT_LAYOUT: LayoutState = {
  sidebarWidth: 320,
  sidebarCollapsed: false,
  previewWidth: Math.round(window.innerWidth * PREVIEW_DEFAULT_RATIO),
  previewCollapsed: false,
  fileTreeWidth: 240,
  fileTreeCollapsed: false,
  terminalOpen: false,
  terminalHeight: TERMINAL_DEFAULT,
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

  const setFileTreeWidth = (width: number) =>
    setLayout((prev) => ({ ...prev, fileTreeWidth: clamp(width, FILE_TREE_MIN, FILE_TREE_MAX) }));

  const toggleFileTree = () =>
    setLayout((prev) => ({ ...prev, fileTreeCollapsed: !prev.fileTreeCollapsed }));

  const togglePreview = () =>
    setLayout((prev) => ({ ...prev, previewCollapsed: !prev.previewCollapsed }));

  const toggleTerminal = () =>
    setLayout((prev) => ({ ...prev, terminalOpen: !prev.terminalOpen }));

  const setTerminalHeight = (height: number) =>
    setLayout((prev) => ({ ...prev, terminalHeight: clamp(height, TERMINAL_MIN, TERMINAL_MAX) }));

  return {
    sidebarWidth: layout.sidebarWidth,
    sidebarCollapsed: layout.sidebarCollapsed,
    setSidebarWidth,
    toggleSidebar,
    previewWidth: clamp(layout.previewWidth, previewMinWidth(), previewMaxWidth()),
    setPreviewWidth,
    previewMinWidth,
    previewMaxWidth,
    fileTreeWidth: layout.fileTreeWidth,
    fileTreeCollapsed: layout.fileTreeCollapsed,
    setFileTreeWidth,
    toggleFileTree,
    previewCollapsed: layout.previewCollapsed,
    togglePreview,
    terminalOpen: layout.terminalOpen,
    terminalHeight: layout.terminalHeight,
    toggleTerminal,
    setTerminalHeight,
  };
}
