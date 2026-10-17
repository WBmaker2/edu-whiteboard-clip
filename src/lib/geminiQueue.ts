export interface GeminiQueueOptions {
  maxConcurrent?: number;
  minIntervalMs?: number;
}

/**
 * Serializes Gemini requests so free-tier keys stay inside a conservative
 * request budget. Requests start at most `maxConcurrent` at a time and never
 * faster than `minIntervalMs` apart.
 */
export class GeminiQueue {
  readonly maxConcurrent: number;
  readonly minIntervalMs: number;
  private active = 0;
  private lastStart = Number.NEGATIVE_INFINITY;
  private waiting: Array<() => void> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: GeminiQueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.minIntervalMs = options.minIntervalMs ?? 1200;
  }

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.waiting.length;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push(() => {
        this.active += 1;
        this.lastStart = Date.now();
        Promise.resolve()
          .then(task)
          .then(resolve, reject)
          .finally(() => {
            this.active -= 1;
            this.pump();
          });
      });
      this.pump();
    });
  }

  private pump(): void {
    if (this.active >= this.maxConcurrent) return;
    if (this.waiting.length === 0) return;
    const wait = this.minIntervalMs - (Date.now() - this.lastStart);
    if (wait > 0) {
      this.schedulePump(wait);
      return;
    }
    const next = this.waiting.shift();
    next?.();
  }

  private schedulePump(delay: number): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pump();
    }, delay);
  }
}

export function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export function backoffMs(attempt: number, base = 900, max = 15_000): number {
  const exponential = Math.min(max, base * 2 ** Math.max(0, attempt - 1));
  return Math.round(exponential * (0.75 + Math.random() * 0.5));
}

export const geminiQueue = new GeminiQueue({ maxConcurrent: 2, minIntervalMs: 1200 });
