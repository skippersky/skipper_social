<script setup lang="ts">
import { useI18nStore } from '../../i18n';
import { dayLabel } from '../../composables/messageGrouping';
import type { CustomerStats } from '../../types';

defineProps<{ stats: CustomerStats | null; loading?: boolean }>();

const i18n = useI18nStore();

function formatDate(value: number | null): string {
  if (value === null) return i18n.t('customers.neverContacted');
  return dayLabel(value, i18n.locale);
}
</script>

<template>
  <section class="cust-stats" :aria-busy="loading ? 'true' : 'false'">
    <div v-if="loading && !stats" class="cust-stats__loading">&hellip;</div>
    <template v-else-if="stats">
      <div class="cust-stats__grid">
        <div class="cust-stats__tile">
          <span class="cust-stats__value">{{ stats.conversationCount }}</span>
          <span class="cust-stats__label">{{ i18n.t('customers.statsConversations') }}</span>
        </div>
        <div class="cust-stats__tile">
          <span class="cust-stats__value">{{ stats.messageCount }}</span>
          <span class="cust-stats__label">{{ i18n.t('customers.statsMessages') }}</span>
        </div>
        <div class="cust-stats__tile">
          <span class="cust-stats__value cust-stats__value--text">{{ formatDate(stats.firstContactAt) }}</span>
          <span class="cust-stats__label">{{ i18n.t('customers.statsFirst') }}</span>
        </div>
        <div class="cust-stats__tile">
          <span class="cust-stats__value cust-stats__value--text">{{ formatDate(stats.lastContactAt) }}</span>
          <span class="cust-stats__label">{{ i18n.t('customers.statsLast') }}</span>
        </div>
      </div>
      <div class="cust-stats__channels">
        <span class="cust-stats__channels-label">{{ i18n.t('customers.statsChannels') }}</span>
        <span v-if="!stats.activeChannels.length" class="cust-stats__none">
          {{ i18n.t('customers.neverContacted') }}
        </span>
        <span
          v-for="platform in stats.activeChannels"
          :key="platform"
          class="cust-stats__channel"
        >{{ i18n.t(`channels.platform.${platform}`) }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.cust-stats {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cust-stats__loading {
  color: var(--ks-text-tertiary);
  text-align: center;
  padding: 8px;
}
.cust-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}
.cust-stats__tile {
  background: var(--ks-bg-base);
  border: 1px solid var(--ks-border-default);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cust-stats__value {
  font-size: 22px;
  line-height: 28px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.cust-stats__value--text {
  font-size: 15px;
  line-height: 28px;
}
.cust-stats__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.cust-stats__channels {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.cust-stats__channels-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ks-text-secondary);
}
.cust-stats__channel {
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  padding: 3px 10px;
  background: var(--ks-grad-soft);
  color: var(--ks-primary-text);
}
.cust-stats__none {
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
</style>