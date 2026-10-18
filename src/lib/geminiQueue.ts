export interface GeminiQueueOptions {
  maxConcurrent?: number;
  minIntervalMs?: number;
}

export interface GeminiRunOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
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

  run<T>(
    task: (signal: AbortSignal) => Promise<T>,
    options: GeminiRunOptions = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push(() => {
        if (options.signal?.aborted) {
          reject(abortError(options.signal.reason));
          this.pump();
          return;
        }
        this.active += 1;
        this.lastStart = Date.now();
        const controller = new AbortController();
        let timedOut = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const onExternalAbort = () => {
          controller.abort(options.signal?.reason);
        };
        if (options.signal) {
          options.signal.addEventListener("abort", onExternalAbort, { once: true });
        }
        const cleanup = () => {
          if (timer !== null) clearTimeout(timer);
          options.signal?.removeEventListener("abort", onExternalAbort);
        };

        const taskPromise = Promise.resolve().then(() => task(controller.signal));
        const timeoutMs = options.timeoutMs ?? 0;
        const timeoutPromise =
          timeoutMs > 0
            ? new Promise<never>((_, rejectTimeout) => {
                timer = setTimeout(() => {
                  timedOut = true;
                  const error = new DOMException(
                    `Gemini 요청이 ${Math.round(timeoutMs / 1000)}초 안에 끝나지 않아 중단했습니다.`,
                    "TimeoutError",
                  );
                  controller.abort(error);
                  rejectTimeout(error);
                }, timeoutMs);
              })
            : null;

        const attempt = timeoutPromise
          ? Promise.race([taskPromise, timeoutPromise])
          : taskPromise;
        attempt
          .then(resolve, (error) => {
            if (timedOut && !(error instanceof DOMException && error.name === "TimeoutError")) {
              reject(
                new DOMException(
                  `Gemini 요청이 ${Math.round(timeoutMs / 1000)}초 안에 끝나지 않아 중단했습니다.`,
                  "TimeoutError",
                ),
              );
              return;
            }
            reject(error);
          })
          .finally(() => {
            cleanup();
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

function abortError(reason?: unknown): DOMException {
  if (reason instanceof DOMException) return reason;
  return new DOMException("Request cancelled", "AbortError");
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
