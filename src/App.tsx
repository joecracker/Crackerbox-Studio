import { useEffect, useRef } from "react";
import AppHeader from "./components/layout/AppHeader";
import PanelResizer from "./components/layout/PanelResizer";
import Sidebar from "./components/layout/Sidebar";
import FileTreePanel from "./components/files/FileTreePanel";
import FileViewer from "./components/files/FileViewer";
import LivePreviewPanel from "./components/preview/LivePreviewPanel";
import ParametersPanel from "./components/parameters/ParametersPanel";
import TokenCounter from "./components/parameters/TokenCounter";
import ZenView from "./components/zen/ZenView";
import {
  FILE_TREE_MAX,
  FILE_TREE_MIN,
  PARAMETERS_MAX,
  PARAMETERS_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  useLayout,
} from "./hooks/useLayout";
import { useParameters } from "./hooks/useParameters";
import { useModels } from "./hooks/useModels";
import { useTransientFlag } from "./hooks/useTransientFlag";
import { useZenMode } from "./hooks/useZenMode";
import { useFileTree } from "./hooks/useFileTree";
import { demoFiles } from "./data/demoFiles";

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
    fileTreeWidth,
    fileTreeCollapsed,
    setFileTreeWidth,
    toggleFileTree,
    parametersWidth,
    parametersCollapsed,
    setParametersWidth,
    toggleParameters,
  } = useLayout();
  const [sidebarAnimating, sidebarFlash] = useTransientFlag(220);
  const [treeAnimating, treeFlash] = useTransientFlag(220);
  const [paramsAnimating, paramsFlash] = useTransientFlag(220);
  const { zen, toggleZen, exitZen } = useZenMode();
  const zenToggleRef = useRef<HTMLButtonElement>(null);
  const fileTree = useFileTree(demoFiles);
  const parameters = useParameters();
  const modelSource = useModels();
  const deselectFileRef = useRef<() => void>(() => {});
  deselectFileRef.current = fileTree.deselectFile;

  const handleToggleSidebar = () => {
    sidebarFlash();
    toggleSidebar();
  };

  const handleToggleFileTree = () => {
    treeFlash();
    toggleFileTree();
  };

  const handleToggleParameters = () => {
    paramsFlash();
    toggleParameters();
  };

  useEffect(() => {
    if (!zen) zenToggleRef.current?.focus();
  }, [zen]);

  useEffect(() => {
    if (zen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      deselectFileRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zen]);

  if (zen) return <ZenView onExit={exitZen} />;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <AppHeader
        fileTreeCollapsed={fileTreeCollapsed}
        onToggleFileTree={handleToggleFileTree}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        zenActive={zen}
        onToggleZen={toggleZen}
        zenToggleRef={zenToggleRef}
        parametersCollapsed={parametersCollapsed}
        onToggleParameters={handleToggleParameters}
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
        {!parametersCollapsed && (
          <PanelResizer
            width={parametersWidth}
            minWidth={PARAMETERS_MIN}
            maxWidth={PARAMETERS_MAX}
            onResize={setParametersWidth}
            invert
            label="Resize parameters panel"
          />
        )}
        <ParametersPanel
          width={parametersWidth}
          collapsed={parametersCollapsed}
          transitioning={paramsAnimating}
          parameters={parameters}
          models={modelSource.models}
          loading={modelSource.loading}
          error={modelSource.error}
          onReload={modelSource.reload}
        />
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
