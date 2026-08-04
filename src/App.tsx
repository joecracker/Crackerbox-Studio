import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import AppHeader from "./components/layout/AppHeader";
import PanelResizer from "./components/layout/PanelResizer";
import Sidebar from "./components/layout/Sidebar";
import FileTreePanel from "./components/files/FileTreePanel";
import FileViewer from "./components/files/FileViewer";
import LivePreviewPanel from "./components/preview/LivePreviewPanel";
import ParametersDialog from "./components/parameters/ParametersDialog";
import TokenCounter from "./components/parameters/TokenCounter";
import ZenView from "./components/zen/ZenView";
import CommandPalette from "./components/commands/CommandPalette";
import ShortcutsDialog from "./components/commands/ShortcutsDialog";
import ContextMenu from "./components/commands/ContextMenu";
import type { PaletteCommand } from "./components/commands/CommandPalette";
import type { ShortcutItem } from "./components/commands/ShortcutsDialog";
import type { ContextMenuItem } from "./components/commands/ContextMenu";
import {
  FILE_TREE_MAX,
  FILE_TREE_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  useLayout,
} from "./hooks/useLayout";
import { useParameters } from "./hooks/useParameters";
import { useModels } from "./hooks/useModels";
import { useTransientFlag } from "./hooks/useTransientFlag";
import { useZenMode } from "./hooks/useZenMode";
import { useFileTree } from "./hooks/useFileTree";
import { useShortcuts } from "./hooks/useShortcuts";
import { demoFiles, flattenFiles } from "./data/demoFiles";

export default function App() {
  const {
    sidebarWidth,
    sidebarCollapsed,
    setSidebarWidth,
    toggleSidebar,
    previewWidth,
    previewCollapsed,
    setPreviewWidth,
    previewMinWidth,
    previewMaxWidth,
    fileTreeWidth,
    fileTreeCollapsed,
    setFileTreeWidth,
    toggleFileTree,
    togglePreview,
  } = useLayout();
  const [sidebarAnimating, sidebarFlash] = useTransientFlag(220);
  const [treeAnimating, treeFlash] = useTransientFlag(220);
  const { zen, toggleZen, exitZen } = useZenMode();
  const zenToggleRef = useRef<HTMLButtonElement>(null);
  const parametersToggleRef = useRef<HTMLButtonElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const wasParametersOpenRef = useRef(false);
  const [parametersOpen, setParametersOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetPath: string | null;
  } | null>(null);
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;
  const fileTree = useFileTree(demoFiles);
  const parameters = useParameters();
  const modelSource = useModels();
  const deselectFileRef = useRef<() => void>(() => {});
  deselectFileRef.current = fileTree.deselectFile;

  const dialogOpen = parametersOpen || paletteOpen || shortcutsOpen || contextMenu !== null;
  const dialogOpenRef = useRef(dialogOpen);
  dialogOpenRef.current = dialogOpen;

  const handleToggleSidebar = () => {
    sidebarFlash();
    toggleSidebar();
  };

  const handleToggleFileTree = () => {
    treeFlash();
    toggleFileTree();
  };

  const handleCloseParameters = () => {
    setParametersOpen(false);
  };

  const handleShellContextMenu = (e: ReactMouseEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath: null });
  };

  const handleFileContextMenu = (path: string, x: number, y: number) => {
    fileTree.openFile(path);
    setContextMenu({ x, y, targetPath: path });
  };

  const coreCommands: PaletteCommand[] = [
    { id: "toggle-sidebar", label: "Toggle sidebar", shortcut: "Ctrl+B", run: handleToggleSidebar },
    {
      id: "toggle-filetree",
      label: "Toggle file tree",
      shortcut: "Ctrl+Shift+E",
      run: handleToggleFileTree,
    },
    {
      id: "toggle-preview",
      label: "Toggle preview panel",
      shortcut: "Ctrl+Shift+P",
      run: togglePreview,
    },
    {
      id: "open-parameters",
      label: "Open parameters",
      shortcut: "Ctrl+Shift+,",
      run: () => setParametersOpen(true),
    },
    {
      id: "toggle-zen",
      label: "Toggle zen mode",
      shortcut: "Ctrl+Alt+Z",
      run: toggleZen,
    },
  ];

  const paletteCommands: PaletteCommand[] = [
    ...coreCommands,
    { id: "close-file", label: "Close current file", run: fileTree.deselectFile },
    {
      id: "keyboard-shortcuts",
      label: "Keyboard shortcuts",
      run: () => setShortcutsOpen(true),
    },
    ...flattenFiles(demoFiles).map(
      (f): PaletteCommand => ({
        id: `open:${f.path}`,
        label: `Open file: ${f.name}`,
        keywords: f.path,
        run: () => fileTree.selectFile(f.path),
      }),
    ),
  ];

  const contextMenuItems: ContextMenuItem[] = [];
  if (contextMenu) {
    const path = contextMenu.targetPath;
    if (path) {
      contextMenuItems.push({
        id: "open-file",
        label: "Open file",
        run: () => fileTree.openFile(path),
      });
      contextMenuItems.push({
        id: "copy-path",
        label: "Copy path",
        run: () => {
          void navigator.clipboard.writeText(path);
        },
      });
      if (fileTree.activePath === path) {
        contextMenuItems.push({
          id: "close-file",
          label: "Close file",
          run: () => fileTree.deselectFile(),
        });
      }
    }
    coreCommands.forEach((command, i) => {
      contextMenuItems.push({
        id: command.id,
        label: command.label,
        shortcut: command.shortcut,
        separatorBefore: path !== null && i === 0,
        run: command.run,
      });
    });
    contextMenuItems.push({
      id: "keyboard-shortcuts",
      label: "Keyboard shortcuts",
      separatorBefore: true,
      run: () => setShortcutsOpen(true),
    });
  }

  const shortcuts: ShortcutItem[] = [
    { label: "Toggle command palette", combo: "Ctrl+K" },
    { label: "Toggle sidebar", combo: "Ctrl+B" },
    { label: "Toggle file tree", combo: "Ctrl+Shift+E" },
    { label: "Toggle preview panel", combo: "Ctrl+Shift+P" },
    { label: "Open parameters", combo: "Ctrl+Shift+," },
    { label: "Toggle zen mode", combo: "Ctrl+Alt+Z" },
    { label: "Close file or dialog", combo: "Esc" },
  ];

  useShortcuts(!zen, [
    {
      combo: "Ctrl+K",
      handler: () => {
        if (dialogOpenRef.current && !paletteOpenRef.current) return;
        setPaletteOpen((open) => !open);
      },
    },
    {
      combo: "Ctrl+B",
      handler: () => {
        if (dialogOpenRef.current) return;
        handleToggleSidebar();
      },
    },
    {
      combo: "Ctrl+Shift+E",
      handler: () => {
        if (dialogOpenRef.current) return;
        handleToggleFileTree();
      },
    },
    {
      combo: "Ctrl+Shift+P",
      handler: () => {
        if (dialogOpenRef.current) return;
        togglePreview();
      },
    },
    {
      combo: "Ctrl+Shift+,",
      handler: () => {
        if (dialogOpenRef.current) return;
        setParametersOpen(true);
      },
    },
    {
      combo: "Ctrl+Alt+Z",
      handler: () => {
        if (dialogOpenRef.current) return;
        toggleZen();
      },
    },
  ]);

  useEffect(() => {
    if (!zen) zenToggleRef.current?.focus();
  }, [zen]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.inert = dialogOpen;
  }, [dialogOpen]);

  useEffect(() => {
    if (!parametersOpen && wasParametersOpenRef.current) {
      parametersToggleRef.current?.focus();
    }
    wasParametersOpenRef.current = parametersOpen;
  }, [parametersOpen]);

  useEffect(() => {
    if (zen || dialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      deselectFileRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zen, dialogOpen]);

  if (zen) return <ZenView onExit={exitZen} />;

  return (
    <>
      <div
        ref={shellRef}
        className="flex h-screen flex-col bg-zinc-950 text-zinc-100"
        onContextMenu={handleShellContextMenu}
      >
        <AppHeader
          fileTreeCollapsed={fileTreeCollapsed}
          onToggleFileTree={handleToggleFileTree}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          zenActive={zen}
          onToggleZen={toggleZen}
          zenToggleRef={zenToggleRef}
          parametersOpen={parametersOpen}
          onOpenParameters={() => setParametersOpen(true)}
          parametersToggleRef={parametersToggleRef}
        />
        <div className="flex min-h-0 flex-1">
          <FileTreePanel
            width={fileTreeWidth}
            collapsed={fileTreeCollapsed}
            transitioning={treeAnimating}
            activePath={fileTree.activePath}
            expanded={fileTree.expanded}
            query={fileTree.query}
            nodes={fileTree.filtered}
            onSelect={fileTree.selectFile}
            onToggle={fileTree.toggleExpanded}
            onQueryChange={fileTree.setQuery}
            onContextMenuFile={handleFileContextMenu}
          />
          {!fileTreeCollapsed && (
            <PanelResizer
              width={fileTreeWidth}
              minWidth={FILE_TREE_MIN}
              maxWidth={FILE_TREE_MAX}
              onResize={setFileTreeWidth}
              label="Resize file tree"
            />
          )}
          <Sidebar width={sidebarWidth} collapsed={sidebarCollapsed} transitioning={sidebarAnimating} />
          {!sidebarCollapsed && (
            <PanelResizer
              width={sidebarWidth}
              minWidth={SIDEBAR_MIN}
              maxWidth={SIDEBAR_MAX}
              onResize={setSidebarWidth}
            />
          )}
          <main className="flex min-w-0 flex-1 flex-col">
            <FileViewer file={fileTree.activeFile} onClose={fileTree.deselectFile} />
            <footer className="flex h-10 shrink-0 items-center justify-between border-t border-zinc-800 px-4 text-xs text-zinc-500">
              <span>Cracker Box — your AI dev workspace</span>
              <TokenCounter />
            </footer>
          </main>
          {!previewCollapsed && (
            <LivePreviewPanel
              width={previewWidth}
              minWidth={previewMinWidth()}
              maxWidth={previewMaxWidth()}
              onResize={setPreviewWidth}
            />
          )}
        </div>
      </div>
      {parametersOpen && (
        <ParametersDialog
          onClose={handleCloseParameters}
          parameters={parameters}
          models={modelSource.models}
          loading={modelSource.loading}
          error={modelSource.error}
          onReload={modelSource.reload}
        />
      )}
      {paletteOpen && (
        <CommandPalette onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
      )}
      {shortcutsOpen && (
        <ShortcutsDialog shortcuts={shortcuts} onClose={() => setShortcutsOpen(false)} />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
