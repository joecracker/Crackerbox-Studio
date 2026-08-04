import { useEffect, useRef } from "react";
import AppHeader from "./components/layout/AppHeader";
import PanelResizer from "./components/layout/PanelResizer";
import Sidebar from "./components/layout/Sidebar";
import LivePreviewPanel from "./components/preview/LivePreviewPanel";
import ZenView from "./components/zen/ZenView";
import { SIDEBAR_MAX, SIDEBAR_MIN, useLayout } from "./hooks/useLayout";import { useTransientFlag } from "./hooks/useTransientFlag";
import { useZenMode } from "./hooks/useZenMode";

export default function App() {
  const {
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    toggleSidebar,
    previewWidth,
    setPreviewWidth,
    previewMinWidth,
    previewMaxWidth,
  } = useLayout();
  const [animating, flash] = useTransientFlag(220);
  const { zen, toggleZen, exitZen } = useZenMode();
  const zenToggleRef = useRef<HTMLButtonElement>(null);

  const handleToggleSidebar = () => {
    flash();
    toggleSidebar();
  };

  useEffect(() => {
    if (!zen) zenToggleRef.current?.focus();
  }, [zen]);

  if (zen) return <ZenView onExit={exitZen} />;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <AppHeader
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        zenActive={zen}
        onToggleZen={toggleZen}
        zenToggleRef={zenToggleRef}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar width={sidebarWidth} collapsed={sidebarCollapsed} transitioning={animating} />
        {!sidebarCollapsed && (
          <PanelResizer
            width={sidebarWidth}
            minWidth={SIDEBAR_MIN}
            maxWidth={SIDEBAR_MAX}
            onResize={setSidebarWidth}
          />
        )}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm text-center">
              <h1 className="text-lg font-semibold text-zinc-100">Cracker Box</h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Chat panel lands next. Live preview is on the right.
              </p>
            </div>
          </div>
          <footer className="flex h-10 shrink-0 items-center justify-center border-t border-zinc-800 px-4 text-xs text-zinc-500">
            Cracker Box — your AI dev workspace
          </footer>
        </main>
        <LivePreviewPanel
          width={previewWidth}
          minWidth={previewMinWidth()}
          maxWidth={previewMaxWidth()}
          onResize={setPreviewWidth}
        />
      </div>
    </div>
  );
}
