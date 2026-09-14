/** Rows above which the centre list windows instead of rendering everything. */
export const VIRTUAL_THRESHOLD = 100;

export interface VirtualWindow {
  /** Index of the first rendered row. */
  start: number;
  /** Exclusive index of the last rendered row. */
  end: number;
  /** Pixels of spacer above the rendered slice. */
  offsetTop: number;
  /** Pixels of spacer below the rendered slice. */
  offsetBottom: number;
  /** Total scrollable height in pixels. */
  totalHeight: number;
  /** True when windowing is active. */
  virtual: boolean;
}

export interface WindowOptions {
  itemHeight?: number;
  viewportHeight?: number;
  overscan?: number;
}

export const NOTIFICATION_ROW_HEIGHT = 76;
const DEFAULT_OVERSCAN = 6;

/**
 * Fixed-height windowing for the notification list. Below the threshold every
 * row renders, which keeps short lists simple and avoids scrollbar jitter.
 */
export function computeVirtualWindow(
  count: number,
  scrollTop: number,
  options: WindowOptions = {}
): VirtualWindow {
  const itemHeight = Math.max(1, options.itemHeight ?? NOTIFICATION_ROW_HEIGHT);
  const viewportHeight = Math.max(itemHeight, options.viewportHeight ?? 600);
  const overscan = Math.max(0, options.overscan ?? DEFAULT_OVERSCAN);
  const totalHeight = count * itemHeight;

  if (count <= VIRTUAL_THRESHOLD) {
    return { start: 0, end: count, offsetTop: 0, offsetBottom: 0, totalHeight, virtual: false };
  }

  const visible = Math.ceil(viewportHeight / itemHeight);
  const first = Math.floor(Math.max(0, scrollTop) / itemHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return {
    start,
    end,
    offsetTop: start * itemHeight,
    offsetBottom: Math.max(0, (count - end) * itemHeight),
    totalHeight,
    virtual: true
  };
}
