<script setup lang="ts">
/**
 * ActivityFeed (Sprint 13).
 *
 * The overview page's recent-activity list. Pure presentation: it receives the
 * rows and translates the kind into a verb, so the audit wording lives in one
 * place and in three languages rather than being assembled per call site.
 */
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { OrgActivity } from '../../types';

defineProps<{ activities: OrgActivity[]; limit?: number }>();

const i18n = useI18nStore();

function describe(activity: OrgActivity): string {
  const verb = i18n.t('org.activity.' + activity.kind);
  return activity.targetName
    ? activity.actorName + ' ' + verb + ' ' + activity.targetName
    : activity.actorName + ' ' + verb;
}

function when(activity: OrgActivity): string {
  return relativeTime(activity.createdAt, Date.now(), i18n.locale);
}
</script>

<template>
  <ul v-if="activities.length > 0" class="af" data-testid="activity-feed">
    <li v-for="item in activities.slice(0, limit ?? 10)" :key="item.id" class="af__row" :data-kind="item.kind">
      <span class="af__dot" :data-kind="item.kind" aria-hidden="true"></span>
      <span class="af__text">{{ describe(item) }}</span>
      <time class="af__time" :datetime="new Date(item.createdAt).toISOString()">{{ when(item) }}</time>
    </li>
  </ul>
  <p v-else class="af__empty" data-testid="activity-empty">{{ i18n.t('org.activity.empty') }}</p>
</template>

<style scoped>
.af {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}
.af__row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ks-border-default);
  font-size: 13px;
}
.af__row:last-child {
  border-bottom: none;
}
.af__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ks-primary);
  transform: translateY(-1px);
}
.af__dot[data-kind='member_removed'],
.af__dot[data-kind='member_disabled'],
.af__dot[data-kind='role_deleted'],
.af__dot[data-kind='invitation_cancelled'] {
  background: var(--ks-error);
}
.af__dot[data-kind='settings_updated'],
.af__dot[data-kind='role_updated'],
.af__dot[data-kind='role_changed'] {
  background: var(--ks-accent);
}
.af__text {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--ks-text-primary);
}
.af__time {
  flex: none;
  color: var(--ks-text-tertiary);
  font-size: 12px;
}
.af__empty {
  margin: 0;
  padding: 14px 0;
  color: var(--ks-text-tertiary);
  font-size: 13px;
}
</style>
