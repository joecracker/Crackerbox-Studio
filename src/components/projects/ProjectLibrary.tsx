import type { Project } from "../../hooks/useProjects";
import { flattenFiles } from "../../data/demoFiles";

interface ProjectLibraryProps {
  projects: Project[];
  activeProjectId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ProjectLibrary({
  projects,
  activeProjectId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
}: ProjectLibraryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Projects
        </span>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors hover:bg-zinc-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          + New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {projects.length === 0 && (
          <p className="px-2.5 py-3 text-xs leading-relaxed text-zinc-500">
            No projects yet — create one to get started.
          </p>
        )}
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
                <div
                  className={`truncate text-sm ${
                    active ? "font-medium text-zinc-100" : "text-zinc-300"
                  }`}
                >
                  {project.name}
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
    </div>
  );
}
