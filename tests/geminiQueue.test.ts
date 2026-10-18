import { describe, expect, it, vi } from "vitest";
import { backoffMs, GeminiQueue, retryAfterMs } from "../src/lib/geminiQueue";

describe("GeminiQueue", () => {
  it("limits concurrency and spaces request starts", async () => {
    vi.useFakeTimers();
    try {
      const queue = new GeminiQueue({ maxConcurrent: 1, minIntervalMs: 200 });
      const order: number[] = [];
      const make = (id: number) =>
        queue.run(async () => {
          order.push(id);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return id;
        });
      const first = make(1);
      const second = make(2);
      await vi.advanceTimersByTimeAsync(0);
      expect(order).toEqual([1]);
      await vi.advanceTimersByTimeAsync(50);
      expect(order).toEqual([1]);
      await vi.advanceTimersByTimeAsync(200);
      expect(order).toEqual([1, 2]);
      await Promise.all([first, second]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs up to the concurrency limit", async () => {
    const queue = new GeminiQueue({ maxConcurrent: 2, minIntervalMs: 0 });
    let active = 0;
    let peak = 0;
    const task = () =>
      queue.run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active -= 1;
      });
    await Promise.all([task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });

  it("parses Retry-After seconds and computes jittered backoff", () => {
    const response = new Response(null, {
      status: 429,
      headers: { "retry-after": "2" },
    });
    expect(retryAfterMs(response)).toBe(2000);
    const plain = new Response(null, { status: 429 });
    expect(retryAfterMs(plain)).toBeNull();
    const delay = backoffMs(2, 100);
    expect(delay).toBeGreaterThanOrEqual(150);
    expect(delay).toBeLessThanOrEqual(300);
  });

  it("rejects a task that exceeds its timeout and frees the slot", async () => {
    const queue = new GeminiQueue({ maxConcurrent: 1, minIntervalMs: 0 });
    const slow = queue.run(
      (signal) =>
        new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve("too late"), 5000);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason);
          });
        }),
      { timeoutMs: 30 },
    );
    await expect(slow).rejects.toMatchObject({ name: "TimeoutError" });
    await expect(
      queue.run(async () => "ok", { timeoutMs: 1000 }),
    ).resolves.toBe("ok");
  });

  it("does not start queued tasks when the external signal is already aborted", async () => {
    const queue = new GeminiQueue({ maxConcurrent: 1, minIntervalMs: 0 });
    const controller = new AbortController();
    controller.abort();
    let started = false;
    await expect(
      queue.run(
        async () => {
          started = true;
          return "never";
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toBe(false);
  });
});
