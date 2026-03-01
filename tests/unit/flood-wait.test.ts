import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callWithFloodWait, RateLimiter } from "@/lib/telegram/flood-wait";

describe("callWithFloodWait", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns result on first successful call", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await callWithFloodWait(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws non-FLOOD error immediately without retrying", async () => {
    const error = { errorMessage: "AUTH_KEY_INVALID", code: 401 };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(callWithFloodWait(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("throws after max retries are exceeded for FLOOD_WAIT errors", async () => {
    const floodError = { errorMessage: "FLOOD_WAIT_2", code: 420 };
    const fn = vi.fn().mockRejectedValue(floodError);

    // Make jitter deterministic
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const promise = callWithFloodWait(fn, 2);

    // Attach the rejection handler immediately to avoid unhandled rejection
    const assertion = expect(promise).rejects.toThrow(
      "Max retries exceeded for flood wait"
    );

    // Now advance timers to let the retries proceed
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on FLOOD_WAIT and succeeds on subsequent attempt", async () => {
    const floodError = { errorMessage: "FLOOD_WAIT_1", code: 420 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(floodError)
      .mockResolvedValueOnce("recovered");

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const promise = callWithFloodWait(fn, 3);

    // Advance past the flood wait delay
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 status code with exponential backoff", async () => {
    const rateLimitError = { code: 429 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce("ok");

    const promise = callWithFloodWait(fn, 3);

    // First retry backoff: 2^0 * 1000 = 1000ms
    await vi.advanceTimersByTimeAsync(1_500);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first call completes immediately", async () => {
    const limiter = new RateLimiter();

    const start = Date.now();
    await limiter.throttle("getMessages", 1000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });

  it("delays subsequent calls within minInterval", async () => {
    const limiter = new RateLimiter();

    // First call - no delay
    await limiter.throttle("sendMessage", 500);

    // Second call should be delayed because minInterval not yet passed
    const throttlePromise = limiter.throttle("sendMessage", 500);

    // Advance time past the minInterval
    await vi.advanceTimersByTimeAsync(600);

    await throttlePromise;
    // If we got here without hanging, the throttle worked correctly
  });

  it("does not delay calls for different methods", async () => {
    const limiter = new RateLimiter();

    await limiter.throttle("methodA", 1000);

    // A different method should not be delayed
    const start = Date.now();
    await limiter.throttle("methodB", 1000);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
