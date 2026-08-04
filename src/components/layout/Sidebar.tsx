import { useState } from "react";
import type { ReactNode } from "react";

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 2.5h10a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-.75.75H6.4l-2.9 2.9a.5.5 0 0 1-.85-.35V10.7H3a.75.75 0 0 1-.75-.75v-6A.75.75 0 0 1 3 2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
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
  { id: "chat", label: "Chat", icon: <ChatIcon /> },
  { id: "projects", label: "Projects", icon: <FolderIcon /> },
  { id: "deploy", label: "Deploy", icon: <RocketIcon /> },
  { id: "settings", label: "Settings", icon: <SlidersIcon /> },
];

interface SidebarProps {
  width: number;
  collapsed: boolean;
  transitioning: boolean;
}

export default function Sidebar({ width, collapsed, transitioning }: SidebarProps) {
  const [activeId, setActiveId] = useState("chat");

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
    >
      <div style={{ width, minWidth: width }} className="flex h-full flex-col bg-zinc-950">
        <div className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Workspace
        </div>
        <nav role="navigation" aria-label="Primary" className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
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
        <div className="mt-auto border-t border-zinc-800 px-3 py-3 text-xs leading-relaxed text-zinc-500">
          Layout shell in place — chat &amp; preview land next.
        </div>
      </div>
    </aside>
  );
}
