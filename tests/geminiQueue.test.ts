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
});
