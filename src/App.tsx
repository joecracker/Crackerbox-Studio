import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import GuardrailSettings from "./components/settings/GuardrailSettings";
import ChatView from "./components/chat/ChatView";
import TerminalPanel from "./components/terminal/TerminalPanel";
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
import type { Project } from "./hooks/useProjects";
import {
  driveConfigured,
  isDriveConnected,
  connectBackup,
  saveBackup,
  restoreBackup,
} from "./lib/backup";
import { useTokenVault } from "./hooks/useTokenVault";
import { usePersonality } from "./hooks/usePersonality";
import { useGuardrails } from "./hooks/useGuardrails";
import { useChatHistory } from "./hooks/useChatHistory";
import type { ChatAttachment } from "./hooks/useChatHistory";
import { useChatStream } from "./hooks/useChatStream";
import type { PendingApproval } from "./hooks/useChatStream";
import { useWebContainer } from "./hooks/useWebContainer";
import { usePreviewRuntime } from "./hooks/usePreviewRuntime";
import type { PreviewApprovalRequest } from "./hooks/usePreviewRuntime";
import { flattenFiles } from "./data/demoFiles";
import type { DemoFile } from "./data/demoFiles";
import { readTreeFromContainer, writeWorkspaceFile } from "./utils/workspaceWebContainer";
import { extractPreview } from "./utils/preview";
import { supportsVision } from "./data/models";
import { formatBytes } from "./utils/workspace";
import {
  importFromDataTransfer,
  importFromDirectoryPicker,
  importFromZipFile,
} from "./utils/importer";
import type { ImportResult } from "./utils/importer";

function upsertNode(nodes: DemoFile[], segments: string[], content: string, prefix = ""): DemoFile[] {
  const [head, ...rest] = segments;
  const path = prefix ? `${prefix}/${head}` : head;
  const existing = nodes.find((node) => node.name === head && node.path === path);
  if (rest.length === 0) {
    if (existing) return nodes.map((node) => (node === existing ? { ...node, content } : node));
    return [...nodes, { name: head, type: "file", path, content }];
  }
  if (existing && existing.type === "folder") {
    return nodes.map((node) =>
      node === existing
        ? { ...node, children: upsertNode(node.children ?? [], rest, content, path) }
        : node
    );
  }
  const folder: DemoFile = {
    name: head,
    type: "folder",
    path,
    children: upsertNode([], rest, content, path),
  };
  return nodes.map((node) => (node === existing ? folder : node)).concat(existing ? [] : [folder]);
}

function updateFileContent(nodes: DemoFile[], path: string, content: string): DemoFile[] {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return nodes;
  return upsertNode(nodes, segments, content);
}

function removeFileNode(nodes: DemoFile[], path: string): DemoFile[] {
  const next: DemoFile[] = [];
  for (const node of nodes) {
    if (node.path === path) continue;
    if (node.children) next.push({ ...node, children: removeFileNode(node.children, path) });
    else next.push(node);
  }
  return next;
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
    terminalOpen,
    terminalHeight,
    toggleTerminal,
    setTerminalHeight,
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
  const guardrails = useGuardrails();
  const webContainer = useWebContainer();
  const chat = useChatHistory(projects.activeProjectId);
  const activeFiles = projects.activeProject.files;
  const fileTree = useFileTree(activeFiles);
  const edits = useEdits();
  const parameters = useParameters();

  const [mutationTick, setMutationTick] = useState(0);
  const [previewApproval, setPreviewApproval] = useState<PendingApproval | null>(null);
  const previewApprovalResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const persistFile = useMemo(
    () => (path: string, content: string) => {
      projects.updateActiveFiles((prev) => updateFileContent(prev, path, content));
      setMutationTick((t) => t + 1);
    },
    [projects]
  );

  const removeFile = useMemo(
    () => (path: string) => {
      projects.updateActiveFiles((prev) => removeFileNode(prev, path));
      setMutationTick((t) => t + 1);
    },
    [projects]
  );

  const syncFromContainer = useCallback(async () => {
    const container = webContainer.container;
    if (!container) return;
    try {
      const tree = await readTreeFromContainer(container);
      projects.updateActiveFiles(() => tree);
      setMutationTick((t) => t + 1);
    } catch {
      // keep the last-good mirror if the read-back fails
    }
  }, [webContainer.container, projects]);

  useEffect(() => {
    const key = projects.activeProjectId;
    if (!projects.hydrated) return;
    if (webContainer.ready) {
      if (webContainer.projectKey !== key) {
        void webContainer.boot(activeFiles, key);
      }
    } else if (!webContainer.booting && webContainer.available) {
      void webContainer.boot(activeFiles, key);
    }
  }, [webContainer, activeFiles, projects.activeProjectId, projects.hydrated]);

  const chatStream = useChatStream({
    activeProjectId: projects.activeProjectId,
    messages: chat.messages,
    model: parameters.selectedModelId,
    systemPrompt: personality.composePrompt(parameters.systemPrompt),
    temperature: parameters.temperature,
    maxTokens: parameters.maxTokens,
    getApiKey: () => (vault.unlocked ? vault.tokens.openrouter ?? null : null),
    workspaceFiles: activeFiles,
    webContainer: webContainer.container,
    webContainerAvailable: webContainer.available,
    guardrailMode: guardrails.mode,
    whenReady: (timeoutMs?: number) => webContainer.whenReady(timeoutMs),
    refreshTree: syncFromContainer,
    persistFile,
    removeFile,
    appendAssistant: chat.appendAssistant,
    patchAssistant: chat.patchAssistant,
    removeAssistant: chat.removeAssistant,
    setAssistantToolCalls: chat.setAssistantToolCalls,
    patchAssistantToolCall: chat.patchAssistantToolCall,
  });
  const requestPreviewApproval = useCallback(
    (pending: PreviewApprovalRequest): Promise<boolean> =>
      new Promise<boolean>((resolve) => {
        previewApprovalResolverRef.current = resolve;
        setPreviewApproval({
          callId: `preview-start-${pending.projectKey}`,
          name: "preview_start",
          path: "",
          content: "",
          oldContent: "",
          newContent: "",
          rationale:
            "This project's dev server has never been started on this device. Approving will run " +
            "npm install and npm run dev inside the sandboxed container so the live preview can render.",
          command: pending.command,
        });
      }),
    []
  );

  const handlePreviewApprove = useCallback(() => {
    const resolve = previewApprovalResolverRef.current;
    previewApprovalResolverRef.current = null;
    setPreviewApproval(null);
    resolve?.(true);
  }, []);

  const handlePreviewReject = useCallback(() => {
    const resolve = previewApprovalResolverRef.current;
    previewApprovalResolverRef.current = null;
    setPreviewApproval(null);
    resolve?.(false);
  }, []);

  const previewRuntime = usePreviewRuntime({
    container: webContainer.container,
    ready: webContainer.ready,
    available: webContainer.available,
    projectKey: webContainer.projectKey,
    mutationTick,
    requestApproval: requestPreviewApproval,
  });
  const handleResetContainer = useCallback(() => {
    void webContainer.reset(activeFiles, projects.activeProjectId);
  }, [webContainer, activeFiles, projects.activeProjectId]);

  const [importNotice, setImportNotice] = useState<string | null>(null);
  const importNoticeTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(importNoticeTimer.current), []);

  const showImportNotice = useCallback((message: string) => {
    setImportNotice(message);
    window.clearTimeout(importNoticeTimer.current);
    importNoticeTimer.current = window.setTimeout(() => setImportNotice(null), 6000);
  }, []);

  const describeImport = useCallback((result: ImportResult): string => {
    const name = result.name ?? "Imported Project";
    let text = `Imported "${name}" — ${result.fileCount} file${result.fileCount === 1 ? "" : "s"} (${formatBytes(result.totalBytes)})`;
    if (result.skipped.length > 0) {
      text += `; skipped ${result.skipped.length}${result.exceeded ? "+" : ""} (excluded/binary/oversized)`;
    }
    return text;
  }, []);

  const handleImportFolder = useCallback(async () => {
    const result = await importFromDirectoryPicker();
    if (result.error === null && !result.ok) return; // cancelled
    if (!result.ok) {
      showImportNotice(result.error ?? "Folder import failed");
      return;
    }
    projects.importProject(result.name ?? "Imported Project", result);
    showImportNotice(describeImport(result));
  }, [projects, describeImport, showImportNotice]);

  const handleImportZip = useCallback(
    async (file: File) => {
      const result = await importFromZipFile(file);
      if (!result.ok) {
        showImportNotice(result.error ?? "Zip import failed");
        return;
      }
      projects.importProject(result.name ?? "Imported Project", result);
      showImportNotice(describeImport(result));
    },
    [projects, describeImport, showImportNotice]
  );

  const handleImportData = useCallback(
    async (data: DataTransfer) => {
      const result = await importFromDataTransfer(data);
      if (!result.ok) {
        showImportNotice(result.error ?? "Import failed");
        return;
      }
      projects.importProject(result.name ?? "Imported Project", result);
      showImportNotice(describeImport(result));
    },
    [projects, describeImport, showImportNotice]
  );
  interface CrackerboxBackupPayload {
    projects: Project[];
    activeProjectId: string;
    exportedAt: string;
  }

  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState<string | null>(null);

  const buildBackupPayload = useCallback(
    (): CrackerboxBackupPayload => ({
      projects: projects.projects,
      activeProjectId: projects.activeProjectId,
      exportedAt: new Date().toISOString(),
    }),
    [projects.projects, projects.activeProjectId]
  );

  const applyRestoredBackup = useCallback(
    async (data: Partial<CrackerboxBackupPayload>) => {
      if (!Array.isArray(data.projects) || data.projects.length === 0) {
        showImportNotice("That backup has no projects in it.");
        return false;
      }
      await projects.restoreAll({ projects: data.projects, activeProjectId: data.activeProjectId });
      showImportNotice(`Restored ${data.projects.length} project${data.projects.length === 1 ? "" : "s"}.`);
      return true;
    },
    [projects, showImportNotice]
  );

  const handleDriveConnect = useCallback(async () => {
    setDriveBusy(true);
    setDriveStatus(null);
    try {
      await connectBackup();
      setDriveConnected(true);
      setDriveStatus("Connected to Google Drive.");
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : "Could not connect to Google Drive.");
    } finally {
      setDriveBusy(false);
    }
  }, []);

  const handleDriveSave = useCallback(async () => {
    setDriveBusy(true);
    setDriveStatus(null);
    try {
      await saveBackup(buildBackupPayload());
      setDriveConnected(true);
      setDriveStatus(`Saved ${projects.projects.length} project(s) to Google Drive.`);
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : "Save to Drive failed.");
    } finally {
      setDriveBusy(false);
    }
  }, [buildBackupPayload, projects.projects.length]);

  const handleDriveRestore = useCallback(async () => {
    setDriveBusy(true);
    setDriveStatus(null);
    try {
      const data = await restoreBackup<CrackerboxBackupPayload>();
      if (!data) {
        setDriveStatus("No backup found in Drive yet — save one first.");
        return;
      }
      if (
        !window.confirm(
          `Restore ${data.projects?.length ?? 0} project(s) from Drive? This replaces every project currently on this device.`
        )
      ) {
        return;
      }
      const ok = await applyRestoredBackup(data);
      if (ok) {
        setDriveConnected(true);
        setDriveStatus("Restored from Google Drive.");
      }
    } catch (err) {
      setDriveStatus(err instanceof Error ? err.message : "Restore from Drive failed.");
    } finally {
      setDriveBusy(false);
    }
  }, [applyRestoredBackup]);

  const handleExportBackupJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildBackupPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crackerbox-studio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDriveStatus("Exported JSON file.");
  }, [buildBackupPayload]);

  const handleImportBackupJSONFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Partial<CrackerboxBackupPayload>;
        if (
          !window.confirm(
            `Import ${parsed.projects?.length ?? 0} project(s) from this file? This replaces every project currently on this device.`
          )
        ) {
          return;
        }
        await applyRestoredBackup(parsed);
      } catch (err) {
        showImportNotice(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
      }
    },
    [applyRestoredBackup, showImportNotice]
  );

  const modelSource = useModels();

  const selectedModel = modelSource.models.find((m) => m.id === parameters.selectedModelId);
  const modelLabel = parameters.selectedModelId
    ? selectedModel
      ? `${selectedModel.name} — ${selectedModel.provider}`
      : parameters.selectedModelId
    : null;
  const visionSupported = selectedModel ? supportsVision(selectedModel) : false;

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

  const lastAssistantText = useMemo(() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      if (chat.messages[i].role === "assistant") return chat.messages[i].text;
    }
    return null;
  }, [chat.messages]);

  const lastAssistantTextRef = useRef<string | null>(null);
  lastAssistantTextRef.current = lastAssistantText;

  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  useEffect(() => {
    if (chatStream.busy) return;
    const src = lastAssistantTextRef.current;
    setPreviewDoc(src ? extractPreview(src) : null);
  }, [chatStream.busy, projects.activeProjectId]);
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
    edits.rejectEdit(id);
    const container = webContainer.container;
    if (container && webContainer.ready) {
      void writeWorkspaceFile(container, edit.path, edit.newContent)
        .then(() => syncFromContainer())
        .catch(() => {});
    } else {
      projects.updateActiveFiles((prev) => updateFileContent(prev, edit.path, edit.newContent));
    }
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
    {
      id: "toggle-terminal",
      label: "Toggle terminal",
      shortcut: "Ctrl+`",
      run: toggleTerminal,
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
    { label: "Toggle terminal", combo: "Ctrl+`" },
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
    {
      combo: "Ctrl+`",
      handler: () => {
        if (dialogOpenRef.current) return;
        toggleTerminal();
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
      previewApprovalResolverRef.current?.(false);
      previewApprovalResolverRef.current = null;
      setPreviewApproval(null);
      if (fileTreeCollapsed) handleToggleFileTree();
    }
  }, [projects.activeProjectId, edits, fileTree, fileTreeCollapsed, handleToggleFileTree]);

  if (zen) return <ZenView onExit={exitZen} srcDoc={previewDoc} busy={chatStream.busy} />;

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
          terminalOpen={terminalOpen}
          onToggleTerminal={toggleTerminal}
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
                onImportFolder={handleImportFolder}
                onImportZip={handleImportZip}
                onImportData={handleImportData}
                notice={importNotice}
                driveConfigured={driveConfigured}
                driveConnected={driveConnected}
                driveBusy={driveBusy}
                driveStatus={driveStatus}
                onDriveConnect={handleDriveConnect}
                onDriveSave={handleDriveSave}
                onDriveRestore={handleDriveRestore}
                onExportJSON={handleExportBackupJSON}
                onImportJSONFile={handleImportBackupJSONFile}
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
              <>
                <PersonalitySettings
                  personality={personality}
                  baseSystemPrompt={parameters.systemPrompt}
                />
                <div className="px-3 pb-4">
                  <GuardrailSettings guardrails={guardrails} />
                </div>
              </>
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
                modelLabel={modelLabel}
                visionSupported={visionSupported}
                approval={chatStream.approval}
                onApprove={
                  chatStream.approval
                    ? () => chatStream.resolveApproval(chatStream.approval!.callId, true)
                    : () => {}
                }
                onReject={
                  chatStream.approval
                    ? () => chatStream.resolveApproval(chatStream.approval!.callId, false)
                    : () => {}
                }
                runtimeAvailable={webContainer.available}
                runtimeError={webContainer.error}
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
              srcDoc={previewDoc}
              previewUrl={previewRuntime.url}
              previewStatus={previewRuntime.status}
              liveEpoch={previewRuntime.liveEpoch}
              busy={chatStream.busy}
              onRestart={handleResetContainer}
              approval={previewApproval}
              onApprove={handlePreviewApprove}
              onReject={handlePreviewReject}
            />
          )}
        </div>
        {terminalOpen && (
          <TerminalPanel
            projectName={projects.activeProject.name}
            files={projects.activeProject.files}
            height={terminalHeight}
            onHeightChange={setTerminalHeight}
            onClose={toggleTerminal}
          />
        )}
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
