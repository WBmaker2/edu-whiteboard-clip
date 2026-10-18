import type { Project } from "../../types/project";
import { formatSrtTime, projectDuration, sceneStart } from "../time";

export function buildSrt(
  project: Project,
  translations?: string[][],
  language = "ko",
): string {
  const lines: string[] = [];
  let counter = 1;
  const total = projectDuration(project);
  project.scenes.forEach((scene, sceneIndex) => {
    const base = sceneStart(project.scenes, sceneIndex);
    scene.beats.forEach((beat, beatIndex) => {
      const window = scene.windows[beatIndex] ?? [0, scene.duration];
      const start = Math.min(total, base + window[0]);
      const end = Math.min(total, base + window[1]);
      const translated =
        language !== "ko" && translations?.[sceneIndex]?.[beatIndex];
      const text = translated || beat.narration;
      lines.push(String(counter));
      lines.push(`${formatSrtTime(start)} --> ${formatSrtTime(end)}`);
      lines.push(text);
      lines.push("");
      counter += 1;
    });
  });
  return lines.join("\n");
}
