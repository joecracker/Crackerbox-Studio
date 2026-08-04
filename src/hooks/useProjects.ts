import { usePersistentState } from "./usePersistentState";
import { demoFiles } from "../data/demoFiles";
import type { DemoFile } from "../data/demoFiles";

export interface Project {
  id: string;
  name: string;
  files: DemoFile[];
}

interface ProjectsState {
  projects: Project[];
  activeProjectId: string;
}

const PROJECTS_KEY = "crackerbox.projects";

function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const INITIAL_STATE: ProjectsState = {
  projects: [{ id: "demo", name: "Demo Project", files: demoFiles }],
  activeProjectId: "demo",
};

export function useProjects() {
  const [state, setState] = usePersistentState<ProjectsState>(PROJECTS_KEY, INITIAL_STATE);

  const activeProject =
    state.projects.find((p) => p.id === state.activeProjectId) ?? state.projects[0];

  const createProject = (name: string): string => {
    const id = createId();
    const project: Project = { id, name: name.trim() || "Untitled", files: [] };
    setState((prev) => ({
      projects: [...prev.projects, project],
      activeProjectId: id,
    }));
    return id;
  };

  const renameProject = (id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === id ? { ...p, name: name.trim() || p.name } : p
      ),
    }));
  };

  const deleteProject = (id: string) => {
    setState((prev) => {
      const remaining = prev.projects.filter((p) => p.id !== id);
      if (remaining.length === 0) {
        const fresh: Project = { id: createId(), name: "Untitled", files: [] };
        return { projects: [fresh], activeProjectId: fresh.id };
      }
      return {
        projects: remaining,
        activeProjectId: prev.activeProjectId === id ? remaining[0].id : prev.activeProjectId,
      };
    });
  };

  const switchProject = (id: string) => {
    setState((prev) =>
      prev.projects.some((p) => p.id === id) ? { ...prev, activeProjectId: id } : prev
    );
  };

  const updateActiveFiles = (updater: (files: DemoFile[]) => DemoFile[]) => {
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id === prev.activeProjectId ? { ...p, files: updater(p.files) } : p
      ),
    }));
  };

  return {
    projects: state.projects,
    activeProjectId: activeProject.id,
    activeProject,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
    updateActiveFiles,
  };
}
