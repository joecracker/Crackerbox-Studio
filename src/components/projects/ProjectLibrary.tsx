import { useRef, useState } from "react";
import type { Project } from "../../hooks/useProjects";
import type { ProjectSnapshot } from "../../hooks/useProjectStore";
import type { SnapshotController } from "../../hooks/useSnapshots";
import { flattenFiles } from "../../data/demoFiles";

interface ProjectLibraryProps {
  projects: Project[];
  activeProjectId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onImportFolder: () => void;
  onImportZip: (file: File) => void;
  onImportData: (data: DataTransfer) => void;
  notice: string | null;
  snapshots: SnapshotController;
  onCaptureSnapshot: (files: Project["files"], note?: string) => Promise<void>;
  onRestoreSnapshot: (snapshot: ProjectSnapshot) => Promise<void>;
  onDeleteSnapshot: (id: string) => Promise<void>;
  onClearSnapshots: () => Promise<void>;
  driveConfigured: boolean;
  driveConnected: boolean;
  driveBusy: boolean;
  driveStatus: string | null;
  onDriveConnect: () => void;
  onDriveSave: () => void;
  onDriveRestore: () => void;
  onExportJSON: () => void;
  onImportJSONFile: (file: File) => void;
}

export default function ProjectLibrary({
  projects,
  activeProjectId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onImportFolder,
  onImportZip,
  onImportData,
  notice,
  snapshots,
  onCaptureSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onClearSnapshots,
  driveConfigured,
  driveConnected,
  driveBusy,
  driveStatus,
  onDriveConnect,
  onDriveSave,
  onDriveRestore,
  onExportJSON,
  onImportJSONFile,
}: ProjectLibraryProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const triggerFolder = () => {
    setMenuOpen(false);
    onImportFolder();
  };
  const triggerZip = () => {
    setMenuOpen(false);
    zipInputRef.current?.click();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 px-3 pb-2 pt-1">
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Projects
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-zinc-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Import
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close import menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
                <button
                  type="button"
                  onClick={triggerFolder}
                  className="block w-full px-3 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  Import folder…
                  <span className="block text-[10px] text-zinc-500">Chrome/Edge</span>
                </button>
                <button
                  type="button"
                  onClick={triggerZip}
                  className="block w-full px-3 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  Import .zip…
                </button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          title="View and restore previous versions of this project"
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            historyOpen ? "text-sky-300" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          History
        </button>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-zinc-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          + New
        </button>
      </div>
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportZip(file);
          e.target.value = "";
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      {notice && (
        <div className="mx-2 mb-1.5 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-sky-200">
          {notice}
        </div>
      )}
      {historyOpen && (
        <div className="mx-2 mb-2 overflow-hidden rounded-md border border-zinc-800">
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5">
            <span className="flex-1 text-[11px] font-semibold text-zinc-300">Version history</span>
            <button
              type="button"
              disabled={snapshots.capturing}
              onClick={() => onCaptureSnapshot(projects.find((p) => p.id === activeProjectId)?.files ?? [], "manual")}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Snapshot now
            </button>
            {snapshots.snapshots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete all saved versions of this project?")) {
                    void onClearSnapshots();
                  }
                }}
                className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-52 overflow-y-auto bg-zinc-950/60">
            {!snapshots.loaded ? (
              <p className="px-3 py-2 text-[11px] text-zinc-500">Loading history…</p>
            ) : snapshots.snapshots.length === 0 ? (
              <p className="px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
                No versions saved yet. Cracker Box snapshots your project automatically as you work, or
                click "Snapshot now" to save one yourself.
              </p>
            ) : (
              snapshots.snapshots.map((snap, i) => (
                <div
                  key={snap.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 ${
                    i > 0 ? "border-t border-zinc-800/60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-200">{snap.note === "auto" ? "Auto" : "Manual"}</span>
                      {i === 0 && (
                        <span className="rounded bg-emerald-500/15 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-emerald-300">
                          newest
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {new Date(snap.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Restore this version? Your current files will be replaced.")) {
                        void onRestoreSnapshot(snap);
                      }
                    }}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteSnapshot(snap.id)}
                    aria-label={`Delete snapshot from ${new Date(snap.createdAt).toLocaleString()}`}
                    className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9h5.8l.6-9M6.5 7v3M9.5 7v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {projects.length === 0 && (
          <p className="px-2.5 py-3 text-xs leading-relaxed text-zinc-500">
            No projects yet — create one or import a folder / zip to get started.
          </p>
        )}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onImportData(e.dataTransfer);
          }}
          className={`flex flex-col gap-px rounded-md border border-dashed p-1 transition-colors ${
            dragging ? "border-sky-500 bg-sky-500/5" : "border-transparent"
          }`}
        >
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            const fileCount = flattenFiles(project.files).length;
            return (
              <div
                key={project.id}
                className={`group flex items-center gap-1.5 rounded-md ${
                  active ? "bg-zinc-800" : "hover:bg-zinc-800/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSwitch(project.id)}
                  aria-current={active ? "true" : undefined}
                  className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-sm ${
                        active ? "font-medium text-zinc-100" : "text-zinc-300"
                      }`}
                    >
                      {project.name}
                    </span>
                    {project.origin === "import" && (
                      <span className="shrink-0 rounded bg-violet-500/15 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-violet-300">
                        imported
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {fileCount} file{fileCount === 1 ? "" : "s"}
                  </div>
                </button>
                <div className="flex shrink-0 gap-0.5 pr-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onRename(project.id)}
                    aria-label={`Rename ${project.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M9.5 3.5 12.5 6.5M3.5 12.5l.6-2.4 6.6-6.6 1.8 1.8-6.6 6.6-2.4.6Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(project.id)}
                    aria-label={`Delete ${project.name}`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.6 9h6.8l.6-9M6.5 7v4M9.5 7v4"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[10px] leading-relaxed text-zinc-600">
          Drag a project folder or .zip here to import it. node_modules, .git, build artifacts, and
          binary files are skipped.
        </p>

        <div className="mt-3 border-t border-zinc-800 pt-2.5">
          <span className="block px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Cloud Backup
          </span>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportJSONFile(file);
              e.target.value = "";
            }}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className="flex flex-col gap-1">
            {driveConfigured ? (
              driveConnected ? (
                <>
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={onDriveSave}
                    className="rounded-md bg-sky-500/15 px-2.5 py-1.5 text-left text-xs text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                  >
                    Save all projects to Google Drive
                  </button>
                  <button
                    type="button"
                    disabled={driveBusy}
                    onClick={onDriveRestore}
                    className="rounded-md bg-zinc-800 px-2.5 py-1.5 text-left text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Restore all projects from Drive
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={driveBusy}
                  onClick={onDriveConnect}
                  className="rounded-md bg-sky-500/15 px-2.5 py-1.5 text-left text-xs text-sky-300 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
                >
                  Connect Google Drive
                </button>
              )
            ) : (
              <span className="px-1 text-[10px] leading-relaxed text-zinc-600">
                Drive backup isn't configured yet (missing Client ID) — see GOOGLE_DRIVE_SETUP.md. JSON
                export/import below still works.
              </span>
            )}
            <div className="mt-1 flex gap-1">
              <button
                type="button"
                onClick={onExportJSON}
                className="flex-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="flex-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Import JSON
              </button>
            </div>
          </div>
          {driveStatus && <p className="mt-1.5 px-1 text-[10px] text-zinc-500">{driveStatus}</p>}
        </div>
      </div>
    </div>
  );
}