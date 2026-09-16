/**
 * Throttled delivery loop for batch marketing sends (Sprint 11).
 *
 * Channel APIs ban accounts that burst, so the queue is a product rule rather
 * than a nicety: a hard per-minute ceiling, a minimum gap between two messages,
 * and the pause/resume/cancel surface the progress dialog drives. The loop
 * yields to the event loop between every send through an injectable delay,
 * which keeps the UI responsive and makes the file testable without real
 * timers. A worker wrapper can call the same functions later; the scheduling
 * maths does not move.
 */
import type { BatchSendProgress } from '../types';
import { RATE_LIMITS } from '../types';

export interface QueueRate {
  perMinute: number;
  intervalMs: number;
}

export interface SendQueueItem {
  id: string;
  name: string;
}

export interface QueueFailure {
  id: string;
  name: string;
  reason: string;
}

export interface QueueSummary {
  total: number;
  sent: number;
  failed: number;
  /** Never attempted, because the queue was cancelled first. */
  skipped: number;
  cancelled: boolean;
  elapsedMs: number;
  failures: QueueFailure[];
}

export interface SendQueueHooks<T> {
  /** Resolves once one recipient was delivered; rejects with the reason. */
  send(item: T): Promise<void>;
  onProgress(progress: BatchSendProgress): void;
  /** Test seam: defaults to a real timer. */
  delay?: (ms: number) => Promise<void>;
  /** Test seam: defaults to Date.now. */
  now?: () => number;
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * Clamps a user-chosen rate to the product limits, then raises the interval so
 * the gap can never undercut the per-minute ceiling. Every entry point goes
 * through here, which is what makes the limit trustworthy.
 */
export function clampRate(perMinute: number, intervalMs: number): QueueRate {
  const safePerMinute = Number.isFinite(perMinute)
    ? Math.min(RATE_LIMITS.maxPerMinute, Math.max(RATE_LIMITS.minPerMinute, round(perMinute)))
    : 10;
  const floorByRate = Math.ceil(60000 / safePerMinute);
  const requested = Number.isFinite(intervalMs) ? round(intervalMs) : 0;
  const interval = Math.min(
    RATE_LIMITS.maxIntervalMs,
    Math.max(RATE_LIMITS.minIntervalMs, floorByRate, requested)
  );
  return { perMinute: safePerMinute, intervalMs: interval };
}

/** Wall-clock time a batch of this size needs, excluding the send calls. */
export function estimateDurationMs(count: number, rate: QueueRate): number {
  if (count <= 1) return 0;
  const clamped = clampRate(rate.perMinute, rate.intervalMs);
  return (count - 1) * clamped.intervalMs;
}

/** Human duration used by the wizard and the progress dialog. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return hours + 'h ' + minutes + 'm';
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((done / total) * 100));
}

export interface SendQueue<T extends SendQueueItem> {
  start(): Promise<QueueSummary>;
  pause(): void;
  resume(): void;
  cancel(): void;
  progress(): BatchSendProgress;
  isPaused(): boolean;
}

/**
 * Creates a queue over an already-selected recipient list. The caller owns the
 * list, so the queue never mutates it; it reports progress and collects
 * failures, which the caller feeds back into the retry action.
 */
export function createSendQueue<T extends SendQueueItem>(
  items: readonly T[],
  rate: QueueRate,
  hooks: SendQueueHooks<T>
): SendQueue<T> {
  const clamped = clampRate(rate.perMinute, rate.intervalMs);
  const delay = hooks.delay ?? defaultDelay;
  const now = hooks.now ?? (() => Date.now());
  const list = [...items];

  let index = 0;
  let sent = 0;
  let failed = 0;
  let paused = false;
  let cancelled = false;
  let startedAt = 0;
  let elapsedMs = 0;
  const failures: QueueFailure[] = [];

  function progress(): BatchSendProgress {
    const done = sent + failed;
    const remaining = Math.max(0, list.length - index);
    return {
      total: list.length,
      done,
      failed,
      running: !cancelled && index < list.length,
      percent: percentOf(done, list.length),
      etaMs: remaining * clamped.intervalMs,
      currentName: index < list.length ? list[index].name : '',
      ratePerMinute: elapsedMs > 0 ? Math.round((done / elapsedMs) * 60000) : 0
    };
  }

  function emit(): void {
    hooks.onProgress(progress());
  }

  async function waitWhilePaused(): Promise<void> {
    while (paused && !cancelled) {
      await delay(100);
    }
  }

  async function start(): Promise<QueueSummary> {
    startedAt = now();
    emit();
    for (; index < list.length; index += 1) {
      await waitWhilePaused();
      if (cancelled) break;
      const item = list[index];
      try {
        await hooks.send(item);
        sent += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          id: item.id,
          name: item.name,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
      elapsedMs = Math.max(1, now() - startedAt);
      emit();
      /* The gap sits after the send so a slow call never doubles it. */
      if (index < list.length - 1 && !cancelled) await delay(clamped.intervalMs);
    }
    return {
      total: list.length,
      sent,
      failed,
      skipped: Math.max(0, list.length - sent - failed),
      cancelled,
      elapsedMs,
      failures
    };
  }

  return {
    start,
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    cancel() {
      cancelled = true;
      paused = false;
    },
    progress,
    isPaused() {
      return paused;
    }
  };
}

/** Failures become the next queue, so a retry only re-sends what broke. */
export function retryableItems<T extends SendQueueItem>(
  items: readonly T[],
  failures: readonly QueueFailure[]
): T[] {
  const ids = new Set(failures.map((failure) => failure.id));
  return items.filter((item) => ids.has(item.id));
}

/** Automatic slow-down applied when a channel answers 429. */
export function backOffRate(rate: QueueRate): QueueRate {
  const halved = Math.max(RATE_LIMITS.minPerMinute, Math.floor(rate.perMinute / 2));
  return clampRate(halved, Math.min(RATE_LIMITS.maxIntervalMs, rate.intervalMs * 2));
}
