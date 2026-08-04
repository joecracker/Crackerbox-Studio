import AppHeader from "./components/layout/AppHeader";
import PanelResizer from "./components/layout/PanelResizer";
import Sidebar from "./components/layout/Sidebar";
import { SIDEBAR_MAX, SIDEBAR_MIN, useLayout } from "./hooks/useLayout";
import { useTransientFlag } from "./hooks/useTransientFlag";

export default function App() {
  const { sidebarWidth, sidebarCollapsed, setSidebarWidth, toggleSidebar } = useLayout();
  const [animating, flash] = useTransientFlag(220);

  const handleToggleSidebar = () => {
    flash();
    toggleSidebar();
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <AppHeader sidebarCollapsed={sidebarCollapsed} onToggleSidebar={handleToggleSidebar} />
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
                Layout shell is in place. Chat, preview, and controls land next.
              </p>
            </div>
          </div>
          <footer className="flex h-10 shrink-0 items-center justify-center border-t border-zinc-800 px-4 text-xs text-zinc-500">
            Cracker Box — your AI dev workspace
          </footer>
        </main>
      </div>
    </div>
  );
}
