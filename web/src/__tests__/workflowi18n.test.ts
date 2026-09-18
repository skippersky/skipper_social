/**
 * Sprint 12 i18n parity guard for the workflow module.
 *
 * Workflow strings live in src/i18n/workflow.ts as [key, en, zh, fr] tuples
 * that messages.ts spreads into each locale table. A tuple cannot lose a locale
 * without failing typecheck, but four things still break at runtime: a locale
 * misses the spread, a {placeholder} drifts between translations, a view asks
 * for a key nobody defined, or a defined key is never asked for and rots. This
 * file pins all four down, mirroring the marketing guard.
 */
import { describe, expect, it } from 'vitest';
import { WORKFLOW_KEYS, workflowMessages } from '../i18n/workflow';
import { UI_LOCALES, messages } from '../i18n/messages';

/** Raw product sources, pulled through Vite so the test needs no node types. */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,vue}', {
  query: '?raw',
  import: 'default',
  eager: true
});

const LITERAL = /'workflow\.[a-zA-Z0-9_.]*'/g;

/**
 * Keys the product code hands to t(). A fragment such as 'workflow.kind.' is a
 * prefix: the caller appends the node kind at runtime.
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

/**
 * Strings that read the same in every language on purpose: brand names, HTTP
 * verbs, and code identifiers shown as field examples. Translating them would
 * make the product wrong, so they are listed explicitly rather than guessed.
 */
const TECHNICAL_KEYS = new Set([
  'workflow.channel.whatsapp',
  'workflow.channel.facebook',
  'workflow.channel.instagram',
  'workflow.channel.tiktok',
  'workflow.common.get',
  'workflow.common.post',
  'workflow.common.put',
  'workflow.common.delete',
  'workflow.field.tagPlaceholder',
  'workflow.field.keywordPlaceholder',
  'workflow.field.campaignIdPlaceholder',
  'workflow.field.expressionPlaceholder',
  'workflow.field.templatePlaceholder',
  'workflow.field.url',
  'workflow.field.urlPlaceholder',
  'workflow.field.fieldPlaceholder'
]);

/** Guards the allow-list itself: real sentences may never hide in it. */
function identifierLike(text: string): boolean {
  if (!/^[A-Za-z][A-Za-z0-9 ._\-:/>]*$/.test(text)) return false;
  return !text.includes(' ') || /[.>:\/]/.test(text);
}

const REFERENCED = referencedKeys();

describe('workflow i18n parity', () => {
  it('defines every key once, inside the workflow namespace', () => {
    expect(WORKFLOW_KEYS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(WORKFLOW_KEYS).size).toBe(WORKFLOW_KEYS.length);
    expect(WORKFLOW_KEYS.filter((key) => !key.startsWith('workflow.'))).toEqual([]);
  });

  it('fills all three locales for every key', () => {
    const gaps: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of WORKFLOW_KEYS) {
        if (!String(messages[locale][key] ?? '').trim()) gaps.push(locale + ':' + key);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('merges the workflow table into the app dictionaries', () => {
    const drift: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of WORKFLOW_KEYS) {
        if (messages[locale][key] !== workflowMessages[locale][key]) drift.push(locale + ':' + key);
      }
    }
    expect(drift).toEqual([]);
  });

  it('keeps interpolation placeholders identical in every locale', () => {
    const mismatched: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of WORKFLOW_KEYS) {
        if (placeholders(workflowMessages[locale][key]) !== placeholders(workflowMessages.en[key])) {
          mismatched.push(locale + ':' + key);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('translates instead of copying English across', () => {
    const untranslated: string[] = [];
    for (const key of WORKFLOW_KEYS) {
      if (TECHNICAL_KEYS.has(key)) continue;
      if (languageNeutral(workflowMessages.en[key])) continue;
      if (!/[\u4e00-\u9fff]/.test(workflowMessages.zh[key])) untranslated.push('zh:' + key);
    }
    expect(untranslated).toEqual([]);
    /* French shares a lot of vocabulary with English, so this one is a ratio. */
    const identical = WORKFLOW_KEYS.filter((key) => workflowMessages.fr[key] === workflowMessages.en[key]);
    expect(identical.length / WORKFLOW_KEYS.length).toBeLessThan(0.2);
  });

  it('resolves every workflow key the product code asks for', () => {
    expect(REFERENCED.length).toBeGreaterThanOrEqual(150);
    const unresolved = REFERENCED.filter(
      (key) => !WORKFLOW_KEYS.includes(key) && !WORKFLOW_KEYS.some((defined) => defined.startsWith(key))
    );
    expect(unresolved).toEqual([]);
  });

  it('only allow-lists real technical tokens, never sentences', () => {
    for (const key of TECHNICAL_KEYS) {
      expect(WORKFLOW_KEYS).toContain(key);
      expect(identifierLike(workflowMessages.en[key]), key).toBe(true);
    }
  });

  it('keeps no workflow string the product code never asks for', () => {
    const unused = WORKFLOW_KEYS.filter(
      (key) => !REFERENCED.some((referenced) => key === referenced || key.startsWith(referenced))
    );
    expect(unused).toEqual([]);
  });
});
