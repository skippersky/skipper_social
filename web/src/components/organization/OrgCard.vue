<script setup lang="ts">
/**
 * OrgCard (Sprint 13).
 *
 * One organisation in the switcher and in the onboarding list: logo or initials,
 * name, the signed-in user's role, and the member count. Selecting it is an emit,
 * so the page owns the tenant switch and its reload.
 */
import { computed } from 'vue';
import KsAvatar from '../KsAvatar.vue';
import RoleBadge from '../permission/RoleBadge.vue';
import { useI18nStore } from '../../i18n';
import { formatNumber } from '../../lib/metrics';
import { orgInitials } from '../../lib/organization';
import type { Organization } from '../../types';

const props = withDefaults(
  defineProps<{
    organization: Organization;
    active?: boolean;
    selectable?: boolean;
  }>(),
  { active: false, selectable: true }
);

const emit = defineEmits<{ (event: 'select', orgId: string): void }>();

const i18n = useI18nStore();

const initials = computed(() => orgInitials(props.organization.name));
const memberCount = computed(() => formatNumber(props.organization.memberCount, i18n.locale));

function onSelect(): void {
  if (props.selectable) emit('select', props.organization.id);
}
</script>

<template>
  <article
    class="oc"
    :class="{ 'is-active': active, 'is-static': !selectable }"
    :data-org-id="organization.id"
    :aria-current="active ? 'true' : undefined"
    :role="selectable ? 'button' : undefined"
    :tabindex="selectable ? 0 : undefined"
    @click="onSelect"
    @keydown.enter.prevent="onSelect"
    @keydown.space.prevent="onSelect"
  >
    <span class="oc__logo" aria-hidden="true">
      <KsAvatar :name="initials" :src="organization.logoUrl" :size="40" />
    </span>
    <div class="oc__body">
      <p class="oc__name">{{ organization.name }}</p>
      <p class="oc__meta">
        <RoleBadge :kind="organization.myRoleKind" size="sm" />
        <span class="oc__count">{{ i18n.t('org.membersCount', { n: memberCount }) }}</span>
      </p>
    </div>
    <span v-if="active" class="oc__active">{{ i18n.t('org.currentBadge') }}</span>
  </article>
</template>

<style scoped>
.oc {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    transform var(--ks-motion-fast) var(--ks-ease);
}
.oc:not(.is-static) {
  cursor: pointer;
}
.oc:not(.is-static):hover {
  border-color: var(--ks-border-strong);
  transform: translateY(-1px);
}
.oc:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
.oc.is-active {
  border-color: var(--ks-primary);
  background: var(--ks-grad-soft);
}
.oc__logo {
  flex: none;
}
.oc__body {
  flex: 1 1 auto;
  min-width: 0;
}
.oc__name {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oc__meta {
  margin: 6px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.oc__count {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.oc__active {
  flex: none;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 11px;
  font-weight: 700;
}
</style>
