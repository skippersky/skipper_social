<script setup lang="ts">
import ChartPanel from './ChartPanel.vue';
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import { formatNumber } from '../../lib/metrics';
import { relativeTime } from '../../lib/relativeTime';
import type { TopCustomer } from '../../types';

const props = withDefaults(
  defineProps<{ rows: TopCustomer[]; loading?: boolean; error?: string | null }>(),
  { loading: false, error: null }
);

const emit = defineEmits<{ (e: 'retry'): void; (e: 'select', customerId: string): void }>();

const i18n = useI18nStore();

function lastContact(value: number | null): string {
  return value === null ? i18n.t('customers.neverContacted') : relativeTime(value, Date.now(), i18n.locale);
}
</script>

<template>
  <ChartPanel
    :title="i18n.t('analytics.topTitle')"
    :subtitle="i18n.t('analytics.topSubtitle')"
    :loading="loading"
    :error="error"
    :empty="rows.length === 0"
    @retry="emit('retry')"
  >
    <table class="top">
      <thead>
        <tr>
          <th class="top__th top__th--rank" scope="col">{{ i18n.t('analytics.topRank') }}</th>
          <th class="top__th" scope="col">{{ i18n.t('analytics.topCustomer') }}</th>
          <th class="top__th top__th--num" scope="col">{{ i18n.t('analytics.topConversations') }}</th>
          <th class="top__th top__th--num" scope="col">{{ i18n.t('analytics.topMessages') }}</th>
          <th class="top__th top__th--last" scope="col">{{ i18n.t('analytics.topLastContact') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.id" class="top__row">
          <td class="top__td top__td--rank">
            <span class="top__rank" :class="{ 'is-lead': index === 0 }">{{ index + 1 }}</span>
          </td>
          <td class="top__td">
            <button class="top__person" type="button" @click="emit('select', row.id)">
              <KsAvatar :name="row.name" :src="row.avatarUrl" :size="32" />
              <span class="top__name">{{ row.name }}</span>
            </button>
          </td>
          <td class="top__td top__td--num">{{ formatNumber(row.conversations, i18n.locale) }}</td>
          <td class="top__td top__td--num">{{ formatNumber(row.messages, i18n.locale) }}</td>
          <td class="top__td top__td--last">{{ lastContact(row.lastContactAt) }}</td>
        </tr>
      </tbody>
    </table>
  </ChartPanel>
</template>

<style scoped>
.top {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.top__th {
  padding: 8px 10px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
  border-bottom: 1px solid var(--ks-border-default);
}
.top__th--rank {
  width: 48px;
}
.top__th--num {
  width: 96px;
  text-align: right;
}
.top__th--last {
  width: 140px;
  text-align: right;
}
.top__row {
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.top__row:hover {
  background: var(--ks-bg-base);
}
.top__td {
  padding: 10px;
  font-size: 13px;
  color: var(--ks-text-primary);
  border-bottom: 1px solid var(--ks-border-default);
  vertical-align: middle;
}
.top__td--num {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.top__td--last {
  text-align: right;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.top__td--rank {
  padding-right: 0;
}
.top__rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 700;
}
.top__rank.is-lead {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.top__person {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  min-width: 0;
  text-align: left;
}
.top__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top__person:hover .top__name {
  color: var(--ks-primary-text);
}
@media (max-width: 767px) {
  .top__th--last,
  .top__td--last {
    display: none;
  }
  .top__th--num,
  .top__td--num {
    width: 64px;
  }
}
</style>