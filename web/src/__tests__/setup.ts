import { afterEach } from 'vitest';

/**
 * Components keep scheduling work that outlives the test: the Vant notice bar
 * checks its scroll width on a timeout, the dashboard debounces range changes,
 * the websocket client schedules heartbeats. When those callbacks fire after
 * jsdom is torn down they surface as "window is not defined" or as a removeChild
 * NotFoundError, which fails an otherwise green suite. Timers are tracked here so
 * every run stays deterministic, and in-flight promise chains are drained while
 * the document is still alive.
 */
type TimerCallback = (...args: unknown[]) => void;
type TimerId = ReturnType<typeof setTimeout>;

const pendingTimeouts = new Set<TimerId>();
const pendingIntervals = new Set<TimerId>();

const nativeSetTimeout = globalThis.setTimeout.bind(globalThis) as (
  cb: TimerCallback,
  ms?: number,
  ...args: unknown[]
) => TimerId;
const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis) as (id?: TimerId) => void;
const nativeSetInterval = globalThis.setInterval.bind(globalThis) as (
  cb: TimerCallback,
  ms?: number,
  ...args: unknown[]
) => TimerId;
const nativeClearInterval = globalThis.clearInterval.bind(globalThis) as (id?: TimerId) => void;

globalThis.setTimeout = ((handler: TimerCallback, timeout?: number, ...args: unknown[]) => {
  const id: TimerId = nativeSetTimeout(() => {
    pendingTimeouts.delete(id);
    handler(...args);
  }, timeout);
  pendingTimeouts.add(id);
  return id;
}) as unknown as typeof setTimeout;

globalThis.clearTimeout = ((id?: TimerId) => {
  if (id !== undefined) pendingTimeouts.delete(id);
  nativeClearTimeout(id);
}) as unknown as typeof clearTimeout;

globalThis.setInterval = ((handler: TimerCallback, timeout?: number, ...args: unknown[]) => {
  const id: TimerId = nativeSetInterval(() => handler(...args), timeout);
  pendingIntervals.add(id);
  return id;
}) as unknown as typeof setInterval;

globalThis.clearInterval = ((id?: TimerId) => {
  if (id !== undefined) pendingIntervals.delete(id);
  nativeClearInterval(id);
}) as unknown as typeof clearInterval;

afterEach(async () => {
  for (const id of pendingTimeouts) nativeClearTimeout(id);
  pendingTimeouts.clear();
  for (const id of pendingIntervals) nativeClearInterval(id);
  pendingIntervals.clear();
  /* One macrotask so queued microtasks and Vue flushes land before teardown. */
  await new Promise<void>((resolve) => nativeSetTimeout(() => resolve(), 0));
});
