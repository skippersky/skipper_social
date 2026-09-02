<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { SubscriptionStatus } from '../../types';

const props = defineProps<{ status: SubscriptionStatus }>();
const i18n = useI18nStore();

const stateClass = computed(() => `status-badge--${props.status.replace('_', '-')}`);
</script>

<template>
  <span class="status-badge" :class="stateClass">{{ i18n.t(`sub.status.${status}`) }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.status-badge--active {
  background: rgba(21, 128, 61, 0.12);
  color: var(--ks-success);
}
.status-badge--trialing {
  background: rgba(91, 91, 214, 0.12);
  color: var(--ks-accent);
}
.status-badge--canceled {
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
}
.status-badge--past-due {
  background: rgba(220, 38, 38, 0.1);
  color: var(--ks-error);
}
</style>