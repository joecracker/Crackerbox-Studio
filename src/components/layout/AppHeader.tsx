import type { Ref } from "react";

interface AppHeaderProps {
  fileTreeCollapsed: boolean;
  onToggleFileTree: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  zenActive: boolean;
  onToggleZen: () => void;
  zenToggleRef?: Ref<HTMLButtonElement>;
  parametersOpen: boolean;
  onOpenParameters: () => void;
  parametersToggleRef?: Ref<HTMLButtonElement>;
}

export default function AppHeader({
  fileTreeCollapsed,
  onToggleFileTree,
  sidebarCollapsed,
  onToggleSidebar,
  zenActive,
  onToggleZen,
  zenToggleRef,
  parametersOpen,
  onOpenParameters,
  parametersToggleRef,
}: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3">
      <button
        type="button"
        onClick={onToggleFileTree}
        aria-label={fileTreeCollapsed ? "Show file tree" : "Hide file tree"}
        aria-expanded={!fileTreeCollapsed}
        aria-controls="app-filetree"
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M1.75 4.25a1 1 0 0 1 1-1h3l1.2 1.5h6.3a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-7.5Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        aria-expanded={!sidebarCollapsed}
        aria-controls="app-sidebar"
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        ref={parametersToggleRef}
        type="button"
        onClick={onOpenParameters}
        aria-label="Parameters"
        aria-haspopup="dialog"
        aria-expanded={parametersOpen}
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 4h11M2.5 8h11M2.5 12h11"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <circle cx="6" cy="4" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="10" cy="8" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="5" cy="12" r="1.2" fill="#09090b" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <span className="text-sm font-semibold tracking-tight text-zinc-100">Cracker Box</span>
      <button
        ref={zenToggleRef}
        type="button"
        onClick={onToggleZen}
        aria-pressed={zenActive}
        aria-label={zenActive ? "Exit zen mode" : "Enter zen mode"}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 2H3.5A1.5 1.5 0 0 0 2 3.5V6M10 2h2.5A1.5 1.5 0 0 1 14 3.5V6M6 14H3.5A1.5 1.5 0 0 1 2 12.5V10M10 14h2.5a1.5 1.5 0 0 0 1.5-1.5V10"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  );
}
