import { useRef } from "react";
import type { ReactNode } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

function FilesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 2.5h5.5L12.5 6v7.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9.5 2.5v3.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.75 4.25a1 1 0 0 1 1-1h3l1.2 1.5h6.3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 10.5 5.5 8C6 4.5 7.6 2.2 11.5 1.5c.7 3.9-1.6 5.5-3.5 9Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 12.5c-.6-.4-.9-.9-1-1.6M2 14c1.5-.1 2.7-.5 3.6-1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 5.5V8l1.8 1.4M3.2 3.6 2 2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6" cy="4" r="1.3" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="10" cy="8" r="1.3" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="5" cy="12" r="1.3" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { id: "files", label: "Files", icon: <FilesIcon /> },
  { id: "projects", label: "Projects", icon: <FolderIcon /> },
  { id: "history", label: "History", icon: <HistoryIcon /> },
  { id: "deploy", label: "Deploy", icon: <RocketIcon /> },
  { id: "settings", label: "Settings", icon: <SlidersIcon /> },
];

interface SidebarProps {
  width: number;
  collapsed: boolean;
  transitioning: boolean;
  activeTab: string;
  onTabChange: (id: string) => void;
  onClose?: () => void;
  children?: ReactNode;
}

export default function Sidebar({
  width,
  collapsed,
  transitioning,
  activeTab,
  onTabChange,
  onClose,
  children,
}: SidebarProps) {
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current = null;
    // Left-swipe on mobile closes the drawer (ignore near-vertical swipes).
    if (dx < -60 && Math.abs(dy) < 80 && onClose) {
      onClose();
    }
  };

  return (
    <aside
      id="app-sidebar"
      ref={(el) => {
        if (el) el.inert = collapsed;
      }}
      aria-label="Primary sidebar"
      className={collapsed ? "shrink-0" : "shrink-0 border-r border-zinc-800"}
      style={{
        width: collapsed ? 0 : width,
        overflow: "hidden",
        transition: transitioning ? "width 180ms ease" : "none",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div style={{ width, minWidth: width }} className="flex h-full flex-col bg-zinc-950">
        <div className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Workspace
        </div>
        <nav role="navigation" aria-label="Primary" className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  active
                    ? "bg-zinc-800 font-medium text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children ?? (
            <div className="flex h-full flex-col justify-end border-t border-zinc-800 px-3 py-3 text-xs leading-relaxed text-zinc-500">
              Chat, deploy, and settings land next.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
