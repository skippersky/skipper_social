import { describe, expect, it } from 'vitest';
import { asChartOption, VChart } from '../lib/echarts';

/*
 * Every other chart test mocks this module so jsdom never needs a canvas. This
 * one imports it for real to prove the tree-shaken registration (line, pie and
 * gauge plus grid/tooltip/legend) loads, and that narrowing is a pass-through.
 */
describe('echarts wiring', () => {
  it('narrows a plain option object without copying it', () => {
    const option: Record<string, unknown> = {
      series: [{ type: 'line', data: [1, 2, 3] }],
      tooltip: { trigger: 'axis' }
    };

    expect(asChartOption(option)).toBe(option);
  });

  it('exposes the vue-echarts component the panels render', () => {
    expect(VChart).toBeTruthy();
  });
});
