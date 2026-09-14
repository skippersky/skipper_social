import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_ROW_HEIGHT,
  VIRTUAL_THRESHOLD,
  computeVirtualWindow
} from '../lib/notificationWindow';

const ROW = NOTIFICATION_ROW_HEIGHT;

describe('computeVirtualWindow', () => {
  it('renders every row while the list stays under the threshold', () => {
    expect(computeVirtualWindow(0, 0)).toEqual({
      start: 0,
      end: 0,
      offsetTop: 0,
      offsetBottom: 0,
      totalHeight: 0,
      virtual: false
    });

    /* The threshold itself is inclusive: 100 rows still render in full. */
    expect(computeVirtualWindow(VIRTUAL_THRESHOLD, 9_999)).toEqual({
      start: 0,
      end: VIRTUAL_THRESHOLD,
      offsetTop: 0,
      offsetBottom: 0,
      totalHeight: VIRTUAL_THRESHOLD * ROW,
      virtual: false
    });
  });

  it('windows the head of a long list', () => {
    const view = computeVirtualWindow(150, 0);

    expect(view.virtual).toBe(true);
    expect(view.start).toBe(0);
    expect(view.end).toBe(14);
    expect(view.offsetTop).toBe(0);
    expect(view.offsetBottom).toBe((150 - 14) * ROW);
    expect(view.totalHeight).toBe(150 * ROW);
  });

  it('keeps an overscan margin on both sides of the viewport', () => {
    const view = computeVirtualWindow(400, 50 * ROW, { viewportHeight: 600 });

    expect(view.start).toBe(44);
    expect(view.end).toBe(64);
    expect(view.offsetTop).toBe(44 * ROW);
    expect(view.offsetBottom).toBe((400 - 64) * ROW);
    expect(view.totalHeight).toBe(400 * ROW);
  });

  it('honours a custom row height, viewport and overscan', () => {
    const view = computeVirtualWindow(300, 400, {
      itemHeight: 40,
      viewportHeight: 200,
      overscan: 2
    });

    expect(view.start).toBe(8);
    expect(view.end).toBe(17);
    expect(view.offsetTop).toBe(8 * 40);
    expect(view.offsetBottom).toBe((300 - 17) * 40);
    expect(view.totalHeight).toBe(300 * 40);
  });

  it('never renders fewer rows than the viewport needs', () => {
    /* A viewport shorter than one row is lifted to a single row of slack. */
    const view = computeVirtualWindow(200, 0, { viewportHeight: 10 });

    expect(view.end).toBe(7);
    expect(view.totalHeight).toBe(200 * ROW);
  });

  it('clamps a negative scroll offset to the top of the list', () => {
    const view = computeVirtualWindow(200, -5_000);

    expect(view.start).toBe(0);
    expect(view.end).toBe(14);
    expect(view.offsetTop).toBe(0);
  });

  it('clamps the tail so the last page never over-reads', () => {
    const view = computeVirtualWindow(200, 199 * ROW);

    expect(view.start).toBe(193);
    expect(view.end).toBe(200);
    expect(view.offsetBottom).toBe(0);
  });

  it('falls back to safe minimums for degenerate options', () => {
    const zeroHeight = computeVirtualWindow(10, 0, { itemHeight: 0, viewportHeight: 0 });
    expect(zeroHeight.totalHeight).toBe(10);
    expect(zeroHeight.end).toBe(10);

    /* A negative overscan collapses to a tight window with no slack rows. */
    const noOverscan = computeVirtualWindow(200, 10 * ROW, { overscan: -4 });
    expect(noOverscan.start).toBe(10);
    expect(noOverscan.end).toBe(18);
  });
});
