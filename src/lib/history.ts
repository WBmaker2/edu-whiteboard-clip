import type { Project } from "../types/project";

export const HISTORY_LIMIT = 50;

export interface ProjectHistory {
  past: Project[];
  future: Project[];
}

export const emptyHistory: ProjectHistory = { past: [], future: [] };

export function pushHistory(
  history: ProjectHistory,
  project: Project,
): ProjectHistory {
  const past = [...history.past, project];
  if (past.length > HISTORY_LIMIT) {
    past.splice(0, past.length - HISTORY_LIMIT);
  }
  return { past, future: [] };
}

export function undoHistory(
  history: ProjectHistory,
  current: Project,
): { history: ProjectHistory; project: Project } | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, HISTORY_LIMIT),
    },
    project: previous,
  };
}

export function redoHistory(
  history: ProjectHistory,
  current: Project,
): { history: ProjectHistory; project: Project } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    history: {
      past: [...history.past, current].slice(-HISTORY_LIMIT),
      future: history.future.slice(1),
    },
    project: next,
  };
}
