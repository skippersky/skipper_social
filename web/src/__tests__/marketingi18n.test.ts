/**
 * Sprint 11 i18n parity guard for the marketing module.
 *
 * Marketing strings live in src/i18n/marketing.ts as [key, en, zh, fr] tuples
 * that messages.ts spreads into each locale table. A tuple cannot lose a locale
 * without failing typecheck, but four things still break at runtime: a locale
 * misses the spread, a {placeholder} drifts between translations, a view asks
 * for a key nobody defined, or a defined key is never asked for and rots. This
 * file pins all four down.
 */
import { describe, expect, it } from 'vitest';
import { MARKETING_KEYS, marketingMessages } from '../i18n/marketing';
import { UI_LOCALES, messages } from '../i18n/messages';

/** Raw product sources, pulled through Vite so the test needs no node types. */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,vue}', {
  query: '?raw',
  import: 'default',
  eager: true
});

const LITERAL = /'marketing\.[a-zA-Z0-9_.]*'/g;

/**
 * Keys the product code hands to t(). A fragment such as 'marketing.wizard.step'
 * is a prefix: the caller appends the step number at runtime.
 */
function referencedKeys(): string[] {
  const found = new Set<string>();
  for (const [file, text] of Object.entries(SOURCES)) {
    if (file.includes('/i18n/') || file.includes('/__tests__/')) continue;
    for (const match of text.match(LITERAL) ?? []) found.add(match.slice(1, -1));
  }
  return [...found];
}

function placeholders(text: string): string {
  return [...text.matchAll(/\{([a-zA-Z]+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

/** True for strings made only of placeholders and punctuation, which read the same anywhere. */
function languageNeutral(text: string): boolean {
  return !/[a-zA-Z]/.test(text.replace(/\{[a-zA-Z]+\}/g, ''));
}

const REFERENCED = referencedKeys();

describe('marketing i18n parity', () => {
  it('defines every key once, inside the marketing namespace', () => {
    expect(MARKETING_KEYS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(MARKETING_KEYS).size).toBe(MARKETING_KEYS.length);
    expect(MARKETING_KEYS.filter((key) => !key.startsWith('marketing.'))).toEqual([]);
  });

  it('fills all three locales for every key', () => {
    const gaps: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of MARKETING_KEYS) {
        if (!String(messages[locale][key] ?? '').trim()) gaps.push(locale + ':' + key);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('merges the marketing table into the app dictionaries', () => {
    const drift: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of MARKETING_KEYS) {
        if (messages[locale][key] !== marketingMessages[locale][key]) drift.push(locale + ':' + key);
      }
    }
    expect(drift).toEqual([]);
  });

  it('keeps interpolation placeholders identical in every locale', () => {
    const mismatched: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of MARKETING_KEYS) {
        if (placeholders(marketingMessages[locale][key]) !== placeholders(marketingMessages.en[key])) {
          mismatched.push(locale + ':' + key);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('translates instead of copying English across', () => {
    const untranslated: string[] = [];
    for (const key of MARKETING_KEYS) {
      if (languageNeutral(marketingMessages.en[key])) continue;
      if (!/[\u4e00-\u9fff]/.test(marketingMessages.zh[key])) untranslated.push('zh:' + key);
    }
    expect(untranslated).toEqual([]);
    /* French shares a lot of vocabulary with English, so this one is a ratio. */
    const identical = MARKETING_KEYS.filter((key) => marketingMessages.fr[key] === marketingMessages.en[key]);
    expect(identical.length / MARKETING_KEYS.length).toBeLessThan(0.2);
  });

  it('resolves every marketing key the product code asks for', () => {
    expect(REFERENCED.length).toBeGreaterThanOrEqual(150);
    const unresolved = REFERENCED.filter(
      (key) => !MARKETING_KEYS.includes(key) && !MARKETING_KEYS.some((defined) => defined.startsWith(key))
    );
    expect(unresolved).toEqual([]);
  });

  it('keeps no marketing string the product code never asks for', () => {
    const unused = MARKETING_KEYS.filter(
      (key) => !REFERENCED.some((referenced) => key === referenced || key.startsWith(referenced))
    );
    expect(unused).toEqual([]);
  });
});
