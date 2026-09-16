/**
 * Throttled batch delivery for the send wizard and the progress dialog
 * (Sprint 11).
 *
 * This is the only place that turns a selected audience into a delivery loop.
 * It wraps lib/sendQueue so the scheduling maths stays testable on its own,
 * adds the store wiring the views need, and keeps two product rules visible:
 * invalid recipients never enter the queue, and a failure is recorded rather
 * than silently dropped so the retry action has something to work with.
 */
import { computed, ref } from 'vue';
import { useMarketingStore } from '../stores/marketing';
import {
  clampRate,
  createSendQueue,
  estimateDurationMs,
  formatDuration,
  retryableItems
} from '../lib/sendQueue';
import type { QueueFailure, QueueRate, QueueSummary, SendQueue } from '../lib/sendQueue';
import type { Recipient, RecipientFilters, SendRecord } from '../types';

/** One queued recipient. The queue keys on id and labels progress with name. */
export interface SendItem {
  id: string;
  name: string;
  recipient: Recipient;
}

/** Delivers one message; reject to mark the recipient failed. */
export type DeliverFn = (item: SendItem) => Promise<SendRecord | null>;

export interface BatchSendOptions {
  /** Test seam forwarded to the queue. */
  delay?: (ms: number) => Promise<void>;
  /** Test seam forwarded to the queue. */
  now?: () => number;
  /** Overrides the default telemetry write. */
  deliver?: DeliverFn;
}

export interface SendEstimate {
  count: number;
  ms: number;
  text: string;
  rate: QueueRate;
}

export function useBatchSend(options: BatchSendOptions = {}) {
  const store = useMarketingStore();
  const failures = ref<QueueFailure[]>([]);
  const lastSummary = ref<QueueSummary | null>(null);

  let queue: SendQueue<SendItem> | null = null;

  const progress = computed(() => store.progress);
  const running = computed(() => store.sending);
  const paused = computed(() => store.sending && queue !== null && queue.isPaused());

  /** Only reachable recipients are queued; the rest stay in the summary panel. */
  const items = computed<SendItem[]>(() =>
    store.validSelected.map((recipient) => ({
      id: recipient.id,
      name: recipient.name,
      recipient
    }))
  );
  const count = computed(() => items.value.length);
  const blocked = computed(() => store.invalidSelected.length);
  const retryable = computed<SendItem[]>(() => retryableItems(items.value, failures.value));

  function defaultDeliver(campaignId: string): DeliverFn {
    return (item) => store.recordSend(campaignId, item.recipient, 'sent');
  }

  /** What the wizard shows before the user commits to a rate. */
  function estimate(rate?: Partial<QueueRate>): SendEstimate {
    const base = store.sendRate;
    const clamped = clampRate(
      rate?.perMinute ?? base.perMinute,
      rate?.intervalMs ?? base.intervalMs
    );
    const ms = estimateDurationMs(items.value.length, clamped);
    return { count: items.value.length, ms, text: formatDuration(ms), rate: clamped };
  }

  async function loadRecipients(filters?: Partial<RecipientFilters>): Promise<Recipient[]> {
    return store.fetchRecipients(filters);
  }

  function toggle(recipientId: string): void {
    store.toggleRecipient(recipientId);
  }

  function selectAll(onlyValid = true): void {
    store.selectAllVisible(onlyValid);
  }

  function select(ids: string[]): void {
    store.selectRecipients(ids);
  }

  function clear(): void {
    store.clearSelection();
  }

  async function validate(): Promise<{ valid: Recipient[]; invalid: Recipient[] }> {
    return store.validateSelection();
  }

  /**
   * Starts the loop. Returns null when nothing can be sent, so the caller can
   * show the right message instead of opening an empty progress dialog.
   */
  async function start(
    campaignId: string,
    rate?: Partial<QueueRate>,
    deliver?: DeliverFn
  ): Promise<QueueSummary | null> {
    if (store.sending) return null;
    const list = items.value;
    if (list.length === 0) return null;
    const base = store.sendRate;
    const clamped = clampRate(
      rate?.perMinute ?? base.perMinute,
      rate?.intervalMs ?? base.intervalMs
    );
    const send = deliver ?? options.deliver ?? defaultDeliver(campaignId);

    failures.value = [];
    lastSummary.value = null;
    queue = createSendQueue<SendItem>(list, clamped, {
      send: async (item) => {
        await send(item);
      },
      onProgress: (next) => store.setProgress(next),
      delay: options.delay,
      now: options.now
    });

    const summary = await queue.start();
    /* The loop stops before emitting its own final frame, so without this the
       store stays in the sending state and blocks both dismiss and a rerun. */
    store.setProgress(queue.progress());
    failures.value = summary.failures;
    lastSummary.value = summary;
    return summary;
  }

  function pause(): void {
    queue?.pause();
  }

  function resume(): void {
    queue?.resume();
  }

  function cancel(): void {
    queue?.cancel();
  }

  /** Clears the finished progress panel; a running queue is left alone. */
  function dismiss(): void {
    if (store.sending) return;
    store.setProgress(null);
  }

  function resetFailures(): void {
    failures.value = [];
  }

  /** Server-side retry: flips failed records back to pending and recounts. */
  async function retryFailed(campaignId: string): Promise<number> {
    return store.retryFailed(campaignId);
  }

  /** Client-side retry: re-queues only what broke, at a slower rate. */
  async function rerunFailures(campaignId: string, deliver?: DeliverFn): Promise<QueueSummary | null> {
    const list = retryable.value;
    if (list.length === 0 || store.sending) return null;
    store.selectRecipients(list.map((item) => item.id));
    const slower = clampRate(Math.max(1, Math.floor(store.sendRate.perMinute / 2)), store.sendRate.intervalMs * 2);
    return start(campaignId, slower, deliver);
  }

  return {
    progress,
    running,
    paused,
    items,
    count,
    blocked,
    retryable,
    failures,
    lastSummary,
    estimate,
    formatDuration,
    loadRecipients,
    toggle,
    selectAll,
    select,
    clear,
    validate,
    start,
    pause,
    resume,
    cancel,
    dismiss,
    resetFailures,
    retryFailed,
    rerunFailures
  };
}
