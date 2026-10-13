/**
 * Sprint 13 i18n parity guard for the organisation module.
 *
 * Organisation strings live in src/i18n/organization.ts as [key, en, zh, fr]
 * tuples that messages.ts spreads into each locale table. A tuple cannot lose a
 * locale without failing typecheck, but four things still break at runtime: a
 * locale misses the spread, a {placeholder} drifts between translations, a
 * component asks for a key nobody defined, or a defined key is never asked for
 * and rots. This file pins all four down, mirroring the marketing and workflow
 * guards.
 *
 * One check is specific to this module. The permission tree, the role presets and
 * the activity feed build their keys at runtime - 'org.perm.' plus an action,
 * 'org.activity.' plus a kind - so scanning the sources for literals cannot see
 * them. Those catalogs are walked directly instead, which is the only way a newly
 * added permission fails loudly when its three translations are forgotten.
 */
import { describe, expect, it } from 'vitest';
import { ORGANIZATION_KEYS, organizationMessages } from '../i18n/organization';
import { UI_LOCALES, messages } from '../i18n/messages';
import { BUILTIN_ROLE_PRESETS, PERMISSION_GROUPS } from '../lib/permissions';
import type { OrgActivityKind, OrgRoleKind } from '../types';

/** Raw product sources, pulled through Vite so the test needs no node types. */
const SOURCES: Record<string, string> = import.meta.glob('../**/*.{ts,vue}', {
  query: '?raw',
  import: 'default',
  eager: true
});

const LITERAL = /'org\.[a-zA-Z0-9_.]*'/g;

/** Every kind the activity feed can be handed; the label is built by suffix. */
const ACTIVITY_KINDS: OrgActivityKind[] = [
  'org_created',
  'member_joined',
  'member_removed',
  'member_disabled',
  'role_created',
  'role_updated',
  'role_deleted',
  'role_changed',
  'invitation_sent',
  'invitation_cancelled',
  'settings_updated',
  'ownership_transferred'
];

const ROLE_KINDS: OrgRoleKind[] = ['owner', 'admin', 'member', 'viewer', 'custom'];

/**
 * Keys the product code hands to t(). A fragment such as 'org.activity.' is a
 * prefix: the caller appends the activity kind at runtime.
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
 * Field examples: a sample address list, a sample logo url, a sample company
 * name. Translating one would make the placeholder wrong, so they are listed
 * explicitly rather than guessed, and the allow-list is itself guarded below.
 */
const EXAMPLE_KEYS = new Set([
  'org.invite.emailsPlaceholder',
  'org.settings.logoPlaceholder',
  'org.onboarding.namePlaceholder'
]);

/**
 * Examples are built from addresses, urls and proper nouns, never from sentences:
 * no terminal punctuation, no character a sample token would not use, and either an
 * address-like shape or at most a handful of words.
 */
function exampleLike(text: string): boolean {
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return false;
  if (!/^[A-Za-z0-9@.,:/_+\- ]+$/.test(trimmed)) return false;
  return /@|https?:\/\//.test(trimmed) || trimmed.split(/\s+/).length <= 4;
}

const REFERENCED = referencedKeys();

describe('organization i18n parity', () => {
  it('defines every key once, inside the organisation namespace', () => {
    expect(ORGANIZATION_KEYS.length).toBeGreaterThanOrEqual(300);
    expect(new Set(ORGANIZATION_KEYS).size).toBe(ORGANIZATION_KEYS.length);
    expect(ORGANIZATION_KEYS.filter((key) => !key.startsWith('org.'))).toEqual([]);
  });

  it('fills all three locales for every key', () => {
    const gaps: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of ORGANIZATION_KEYS) {
        if (!String(messages[locale][key] ?? '').trim()) gaps.push(locale + ':' + key);
      }
    }
    expect(gaps).toEqual([]);
  });

  it('merges the organisation table into the app dictionaries', () => {
    const drift: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of ORGANIZATION_KEYS) {
        if (messages[locale][key] !== organizationMessages[locale][key]) {
          drift.push(locale + ':' + key);
        }
      }
    }
    expect(drift).toEqual([]);
  });

  it('keeps interpolation placeholders identical in every locale', () => {
    const mismatched: string[] = [];
    for (const locale of UI_LOCALES) {
      for (const key of ORGANIZATION_KEYS) {
        if (placeholders(organizationMessages[locale][key]) !== placeholders(organizationMessages.en[key])) {
          mismatched.push(locale + ':' + key);
        }
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('translates instead of copying English across', () => {
    const untranslated: string[] = [];
    for (const key of ORGANIZATION_KEYS) {
      if (EXAMPLE_KEYS.has(key)) continue;
      if (languageNeutral(organizationMessages.en[key])) continue;
      if (!/[\u4e00-\u9fff]/.test(organizationMessages.zh[key])) untranslated.push('zh:' + key);
    }
    expect(untranslated).toEqual([]);
    /* French shares a lot of vocabulary with English, so this one is a ratio. */
    const identical = ORGANIZATION_KEYS.filter(
      (key) => organizationMessages.fr[key] === organizationMessages.en[key]
    );
    expect(identical.length / ORGANIZATION_KEYS.length).toBeLessThan(0.2);
  });

  it('resolves every organisation key the product code asks for', () => {
    expect(REFERENCED.length).toBeGreaterThanOrEqual(200);
    const unresolved = REFERENCED.filter(
      (key) =>
        !ORGANIZATION_KEYS.includes(key) &&
        !ORGANIZATION_KEYS.some((defined) => defined.startsWith(key))
    );
    expect(unresolved).toEqual([]);
  });

  it('labels every kind the runtime builds a key for', () => {
    for (const kind of ROLE_KINDS) {
      expect(ORGANIZATION_KEYS, 'org.role.' + kind).toContain('org.role.' + kind);
      expect(ORGANIZATION_KEYS, 'org.roleDesc.' + kind).toContain('org.roleDesc.' + kind);
    }
    for (const kind of ACTIVITY_KINDS) {
      expect(ORGANIZATION_KEYS, 'org.activity.' + kind).toContain('org.activity.' + kind);
    }
    for (const preset of BUILTIN_ROLE_PRESETS) {
      expect(ORGANIZATION_KEYS).toContain(preset.nameKey);
      expect(ORGANIZATION_KEYS).toContain(preset.descriptionKey);
    }
  });

  it('translates the whole permission catalog, groups and descriptions included', () => {
    expect(PERMISSION_GROUPS.length).toBeGreaterThanOrEqual(8);
    const missing: string[] = [];
    for (const group of PERMISSION_GROUPS) {
      if (!ORGANIZATION_KEYS.includes(group.label)) missing.push(group.label);
      for (const permission of group.permissions) {
        if (!ORGANIZATION_KEYS.includes(permission.label)) missing.push(permission.label);
        if (permission.description && !ORGANIZATION_KEYS.includes(permission.description)) {
          missing.push(permission.description);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('only allow-lists field placeholders, never sentences', () => {
    for (const key of EXAMPLE_KEYS) {
      expect(ORGANIZATION_KEYS).toContain(key);
      /* Membership is earned by the key being a field example, so a real sentence
         can never be excused from translation just by being listed here. */
      expect(key.endsWith('Placeholder'), key).toBe(true);
      for (const locale of UI_LOCALES) {
        expect(exampleLike(organizationMessages[locale][key]), locale + ':' + key).toBe(true);
      }
    }
  });

  it('keeps no organisation string the product code never asks for', () => {
    const unused = ORGANIZATION_KEYS.filter(
      (key) => !REFERENCED.some((referenced) => key === referenced || key.startsWith(referenced))
    );
    expect(unused).toEqual([]);
  });
});
