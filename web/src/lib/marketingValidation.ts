/**
 * Campaign and template form rules (Sprint 11).
 *
 * Mirrors lib/settingsValidation.ts: every function returns an i18n key or
 * null, never a human string, so views render errors in the active locale.
 * The rate rules re-use the product limits from types so a user can never
 * configure a burst that gets a channel account banned.
 */
import type { MarketingContent, SendSettings, TemplateInput } from '../types';
import { RATE_LIMITS } from '../types';
import { isContentSendable } from './marketingContent';

export const CAMPAIGN_NAME_MIN = 2;
export const CAMPAIGN_NAME_MAX = 60;
export const TEMPLATE_NAME_MIN = 2;
export const TEMPLATE_NAME_MAX = 40;
export const TEMPLATE_TITLE_MAX = 120;
export const TEMPLATE_BODY_MAX = 2000;

export type ValidationErrors = Record<string, string>;

/** The three-step wizard draft; content stays null until the AI produced one. */
export interface CampaignDraft {
  name: string;
  content: MarketingContent | null;
  recipientIds: string[];
  settings: SendSettings;
}

function trim(value: string | undefined | null): string {
  return (value ?? '').trim();
}

export function validateCampaignName(value: string): string | null {
  const name = trim(value);
  if (!name) return 'marketing.error.nameRequired';
  if (name.length < CAMPAIGN_NAME_MIN || name.length > CAMPAIGN_NAME_MAX) {
    return 'marketing.error.nameLength';
  }
  return null;
}

export function validateContent(content: MarketingContent | null): string | null {
  return isContentSendable(content) ? null : 'marketing.error.contentRequired';
}

export function validateRecipients(ids: readonly string[]): string | null {
  return ids.length > 0 ? null : 'marketing.error.recipientsRequired';
}

export function validateChannels(channels: readonly string[]): string | null {
  return channels.length > 0 ? null : 'marketing.error.channelsRequired';
}

/**
 * A scheduled send must still be in the future at submit time. The caller
 * passes the current clock so the rule stays testable.
 */
export function validateSchedule(settings: SendSettings, now: number): string | null {
  if (settings.mode !== 'scheduled') return null;
  if (!settings.scheduledAt) return 'marketing.error.scheduleRequired';
  return settings.scheduledAt > now ? null : 'marketing.error.schedulePast';
}

export function validateRate(settings: SendSettings): ValidationErrors {
  const errors: ValidationErrors = {};
  if (
    !Number.isFinite(settings.perMinute) ||
    settings.perMinute < RATE_LIMITS.minPerMinute ||
    settings.perMinute > RATE_LIMITS.maxPerMinute
  ) {
    errors.perMinute = 'marketing.error.rateRange';
  }
  if (
    !Number.isFinite(settings.intervalMs) ||
    settings.intervalMs < RATE_LIMITS.minIntervalMs ||
    settings.intervalMs > RATE_LIMITS.maxIntervalMs
  ) {
    errors.intervalMs = 'marketing.error.intervalRange';
  }
  return errors;
}

/** Runs every wizard rule at once; used to gate the start-sending button. */
export function validateCampaignDraft(draft: CampaignDraft, now: number): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = validateCampaignName(draft.name);
  if (name) errors.name = name;
  const content = validateContent(draft.content);
  if (content) errors.content = content;
  const recipients = validateRecipients(draft.recipientIds);
  if (recipients) errors.recipientIds = recipients;
  const channels = validateChannels(draft.settings.channels);
  if (channels) errors.channels = channels;
  const schedule = validateSchedule(draft.settings, now);
  if (schedule) errors.scheduledAt = schedule;
  Object.assign(errors, validateRate(draft.settings));
  return errors;
}

export function isCampaignDraftValid(draft: CampaignDraft, now: number): boolean {
  return Object.keys(validateCampaignDraft(draft, now)).length === 0;
}

export function validateTemplateForm(input: TemplateInput): ValidationErrors {
  const errors: ValidationErrors = {};
  const name = trim(input.name);
  if (!name) errors.name = 'marketing.error.templateNameRequired';
  else if (name.length < TEMPLATE_NAME_MIN || name.length > TEMPLATE_NAME_MAX) {
    errors.name = 'marketing.error.templateNameLength';
  }
  if (!trim(input.title)) errors.title = 'marketing.error.templateTitleRequired';
  else if (input.title.length > TEMPLATE_TITLE_MAX) errors.title = 'marketing.error.templateTitleTooLong';
  if (!trim(input.content)) errors.content = 'marketing.error.templateBodyRequired';
  else if (input.content.length > TEMPLATE_BODY_MAX) errors.content = 'marketing.error.templateBodyTooLong';
  return errors;
}

export function isTemplateValid(input: TemplateInput): boolean {
  return Object.keys(validateTemplateForm(input)).length === 0;
}

/** Local datetime input value (YYYY-MM-DDTHH:mm) for a scheduled send. */
export function toDateTimeLocal(now: number, offsetMinutes = 30): string {
  const date = new Date(now + offsetMinutes * 60000);
  const pad = (value: number): string => (value < 10 ? '0' + value : String(value));
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  );
}

/** Inverse of toDateTimeLocal; an empty or unparsable value yields null. */
export function fromDateTimeLocal(value: string): number | null {
  const text = trim(value);
  if (!text) return null;
  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
