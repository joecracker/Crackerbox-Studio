import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import AppHeader from "./components/layout/AppHeader";
import PanelResizer from "./components/layout/PanelResizer";
import Sidebar from "./components/layout/Sidebar";
import FileTreePanel from "./components/files/FileTreePanel";
import FileViewer from "./components/files/FileViewer";
import LivePreviewPanel from "./components/preview/LivePreviewPanel";
import ProjectLibrary from "./components/projects/ProjectLibrary";
import ProjectNameDialog from "./components/projects/ProjectNameDialog";
import DeployWizard from "./components/deploy/DeployWizard";
import PersonalitySettings from "./components/settings/PersonalitySettings";
import ChatView from "./components/chat/ChatView";
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
import { useEdits } from "./hooks/useEdits";
import { useProjects } from "./hooks/useProjects";
import { useTokenVault } from "./hooks/useTokenVault";
import { usePersonality } from "./hooks/usePersonality";
import { useChatHistory } from "./hooks/useChatHistory";
import type { ChatAttachment } from "./hooks/useChatHistory";
import { useChatStream } from "./hooks/useChatStream";
import { flattenFiles } from "./data/demoFiles";
import type { DemoFile } from "./data/demoFiles";

function updateFileContent(nodes: DemoFile[], path: string, content: string): DemoFile[] {
  return nodes.map((node) => {
    if (node.path === path) return node.type === "file" ? { ...node, content } : node;
    if (node.children) return { ...node, children: updateFileContent(node.children, path, content) };
    return node;
  });
}

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
  const [sidebarTab, setSidebarTab] = useState("chat");
  const [projectDialog, setProjectDialog] = useState<
    { mode: "create" } | { mode: "rename"; id: string } | null
  >(null);
  const projects = useProjects();
  const vault = useTokenVault();
  const personality = usePersonality();
  const chat = useChatHistory(projects.activeProjectId);
  const activeFiles = projects.activeProject.files;
  const fileTree = useFileTree(activeFiles);
  const edits = useEdits();
  const parameters = useParameters();
  const chatStream = useChatStream({
    activeProjectId: projects.activeProjectId,
    messages: chat.messages,
    model: parameters.selectedModelId,
    systemPrompt: personality.composePrompt(parameters.systemPrompt),
    temperature: parameters.temperature,
    maxTokens: parameters.maxTokens,
    getApiKey: () => (vault.unlocked ? vault.tokens.openrouter ?? null : null),
    appendAssistant: chat.appendAssistant,
    patchAssistant: chat.patchAssistant,
    removeAssistant: chat.removeAssistant,
  });
  const modelSource = useModels();

  const sendBlockedReason = !parameters.selectedModelId
    ? "No model selected — open Parameters (Ctrl+Shift+,) to pick one."
    : !vault.unlocked
      ? "Unlock the vault — open Deploy in the sidebar and enter your passphrase."
      : !vault.tokens.openrouter
        ? "No OpenRouter API key saved — add one under Deploy → Connect accounts."
        : null;

  const handleChatSend = (text: string, attachments: ChatAttachment[]) => {
    chat.send(text, attachments);
    void chatStream.stream(text, attachments);
  };
  const deselectFileRef = useRef<() => void>(() => {});
  deselectFileRef.current = fileTree.deselectFile;

  const dialogOpen =
    parametersOpen || paletteOpen || shortcutsOpen || contextMenu !== null || projectDialog !== null;
  const dialogOpenRef = useRef(dialogOpen);
  dialogOpenRef.current = dialogOpen;
  const previewAutoHiddenRef = useRef(false);

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
    if (e.target instanceof Element && e.target.closest("[data-native-context-menu]")) {
      return;
    }
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, targetPath: null });
  };

  const handleFileContextMenu = (path: string, x: number, y: number) => {
    fileTree.openFile(path);
    setContextMenu({ x, y, targetPath: path });
  };

  const proposeDemoEdit = (path: string) => {
    const file = flattenFiles(activeFiles).find((f) => f.path === path);
    if (!file || file.content == null) return;
    edits.proposeEdit(path, `${file.content}// pending AI edit (demo — review below)\n`, file.content);
  };

  const approveEdit = (id: string) => {
    const edit = edits.pending.find((e) => e.id === id);
    if (!edit) return;
    projects.updateActiveFiles((prev) => updateFileContent(prev, edit.path, edit.newContent));
    edits.rejectEdit(id);
  };

  const handleSwitchProject = (id: string) => {
    if (id !== projects.activeProjectId) projects.switchProject(id);
  };

  const handleRenameProject = (id: string) => {
    setProjectDialog({ mode: "rename", id });
  };

  const handleSubmitProjectName = (name: string) => {
    if (!projectDialog) return;
    if (projectDialog.mode === "create") projects.createProject(name);
    else projects.renameProject(projectDialog.id, name);
    setProjectDialog(null);
  };

  const pendingPaths = useMemo(() => new Set(edits.pending.map((e) => e.path)), [edits.pending]);
  const activeFile = fileTree.activeFile;
  const activePendingEdit = activeFile
    ? edits.pending.find((e) => e.path === activeFile.path)
    : undefined;

  const handleFileSelect = (path: string) => {
    fileTree.openFile(path);
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
    ...flattenFiles(activeFiles).map(
      (f): PaletteCommand => ({
        id: `open:${f.path}`,
        label: `Open file: ${f.name}`,
        keywords: f.path,
        run: () => handleFileSelect(f.path),
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
      const existingEdit = edits.pending.find((e) => e.path === path);
      if (existingEdit) {
        contextMenuItems.push({
          id: "dismiss-pending-edit",
          label: "Dismiss pending edit",
          run: () => edits.rejectEdit(existingEdit.id),
        });
      } else {
        contextMenuItems.push({
          id: "propose-demo-edit",
          label: "Propose demo edit",
          run: () => proposeDemoEdit(path),
        });
      }
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

  useEffect(() => {
    if (activePendingEdit) {
      if (!previewCollapsed && !previewAutoHiddenRef.current) {
        previewAutoHiddenRef.current = true;
        togglePreview();
      }
    } else if (previewAutoHiddenRef.current) {
      previewAutoHiddenRef.current = false;
      if (previewCollapsed) togglePreview();
    }
  }, [activePendingEdit, previewCollapsed, togglePreview]);

  const activeProjectIdRef = useRef(projects.activeProjectId);
  useEffect(() => {
    if (activeProjectIdRef.current !== projects.activeProjectId) {
      activeProjectIdRef.current = projects.activeProjectId;
      edits.clearAll();
      fileTree.deselectFile();
      fileTree.setQuery("");
      setSidebarTab("chat");
      if (fileTreeCollapsed) handleToggleFileTree();
    }
  }, [projects.activeProjectId, edits, fileTree, fileTreeCollapsed, handleToggleFileTree]);

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
            onSelect={handleFileSelect}
            onToggle={fileTree.toggleExpanded}
            onQueryChange={fileTree.setQuery}
            onContextMenuFile={handleFileContextMenu}
            pendingPaths={pendingPaths}
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
          <Sidebar
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
            transitioning={sidebarAnimating}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
          >
            {sidebarTab === "projects" && (
              <ProjectLibrary
                projects={projects.projects}
                activeProjectId={projects.activeProjectId}
                onSwitch={handleSwitchProject}
                onNew={() => setProjectDialog({ mode: "create" })}
                onRename={handleRenameProject}
                onDelete={projects.deleteProject}
              />
            )}
            {sidebarTab === "deploy" && (
              <DeployWizard
                projectName={projects.activeProject.name}
                files={projects.activeProject.files}
                vault={vault}
              />
            )}
            {sidebarTab === "settings" && (
              <PersonalitySettings
                personality={personality}
                baseSystemPrompt={parameters.systemPrompt}
              />
            )}
          </Sidebar>
          {!sidebarCollapsed && (
            <PanelResizer
              width={sidebarWidth}
              minWidth={SIDEBAR_MIN}
              maxWidth={SIDEBAR_MAX}
              onResize={setSidebarWidth}
            />
          )}
          <main className="flex min-w-0 flex-1 flex-col">
            {fileTree.activeFile ? (
              <FileViewer
                file={fileTree.activeFile}
                onClose={fileTree.deselectFile}
                pendingEdit={activePendingEdit}
                onApprove={activePendingEdit ? () => approveEdit(activePendingEdit.id) : undefined}
                onReject={activePendingEdit ? () => edits.rejectEdit(activePendingEdit.id) : undefined}
              />
            ) : (
              <ChatView
                key={projects.activeProjectId}
                projectName={projects.activeProject.name}
                messages={chat.messages}
                onSend={handleChatSend}
                onOpenParameters={() => setParametersOpen(true)}
                streaming={chatStream.busy}
                sendDisabled={sendBlockedReason !== null}
                sendDisabledReason={sendBlockedReason}
                streamError={chatStream.error}
                onDismissStreamError={chatStream.dismissError}
              />
            )}
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
      {projectDialog && (
        <ProjectNameDialog
          title={projectDialog.mode === "create" ? "New project" : "Rename project"}
          initialValue={
            projectDialog.mode === "rename"
              ? (projects.projects.find((p) => p.id === projectDialog.id)?.name ?? "")
              : ""
          }
          onSubmit={handleSubmitProjectName}
          onClose={() => setProjectDialog(null)}
        />
      )}
    </>
  );
}
