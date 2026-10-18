const FONT_FAMILIES: Array<{ family: string; weights: number[] }> = [
  { family: "Pretendard", weights: [400, 500, 600, 700, 800, 900] },
  { family: "IBM Plex Mono", weights: [400, 500, 600] },
];

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Waits until every font weight used by the canvas renderer is ready.
 * Falls back to a timeout so a slow CDN never blocks export entirely.
 */
export function ensureExportFonts(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const loads = FONT_FAMILIES.flatMap(({ family, weights }) =>
    weights.map((weight) =>
      document.fonts.load(`${weight} 48px "${family}"`).catch(() => undefined),
    ),
  );
  const ready = Promise.all(loads)
    .then(() => document.fonts.ready)
    .catch(() => undefined);
  return Promise.race([
    ready.then(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}
