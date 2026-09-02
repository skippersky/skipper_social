import { describe, expect, it } from 'vitest';
import { usePageMeta } from '../composables/usePageMeta';

describe('usePageMeta', () => {
  it('sets the suffixed title and description', () => {
    usePageMeta('Pricing', 'Plans overview');

    expect(document.title).toBe('Pricing - KiliSocial');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Plans overview');
  });

  it('falls back to the site name for empty titles and reuses the meta tag', () => {
    usePageMeta('', 'Updated');

    expect(document.title).toBe('KiliSocial');
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('Updated');
  });
});