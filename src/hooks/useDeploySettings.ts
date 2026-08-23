import { useCallback } from "react";
import { usePersistentState } from "./usePersistentState";

export type DeployStrategy = "manual" | "midnight" | "session";

interface DeploySettingsState {
  strategy: DeployStrategy;
  repoName: string;
  siteName: string;
  repoPrivate: boolean;
  lastAutoDeployDate: string | null;
}

const KEY = "crackerbox.deploy.settings";

const DEFAULTS: DeploySettingsState = {
  strategy: "manual",
  repoName: "",
  siteName: "",
  repoPrivate: true,
  lastAutoDeployDate: null,
};

export interface DeploySettings {
  strategy: DeployStrategy;
  repoName: string;
  siteName: string;
  repoPrivate: boolean;
  lastAutoDeployDate: string | null;
  setStrategy: (strategy: DeployStrategy) => void;
  saveTarget: (target: { repoName: string; siteName: string; repoPrivate: boolean }) => void;
  markAttempt: (dateKey: string) => void;
}

export function useDeploySettings(): DeploySettings {
  const [state, setState] = usePersistentState<DeploySettingsState>(KEY, DEFAULTS);

  const setStrategy = useCallback(
    (strategy: DeployStrategy) => setState((prev) => ({ ...prev, strategy })),
    [setState]
  );

  const saveTarget = useCallback(
    (target: { repoName: string; siteName: string; repoPrivate: boolean }) =>
      setState((prev) => ({
        ...prev,
        repoName: target.repoName,
        siteName: target.siteName,
        repoPrivate: target.repoPrivate,
      })),
    [setState]
  );

  const markAttempt = useCallback(
    (lastAutoDeployDate: string) => setState((prev) => ({ ...prev, lastAutoDeployDate })),
    [setState]
  );

  return {
    strategy: state.strategy,
    repoName: state.repoName,
    siteName: state.siteName,
    repoPrivate: state.repoPrivate,
    lastAutoDeployDate: state.lastAutoDeployDate,
    setStrategy,
    saveTarget,
    markAttempt,
  };
}
