<script setup lang="ts">
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import { relativeTime } from '../../lib/relativeTime';
import type { Customer } from '../../types';

defineProps<{ customer: Customer }>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();

const i18n = useI18nStore();
</script>

<template>
  <van-swipe-cell>
    <button class="cust-item" type="button" @click="emit('select')">
      <KsAvatar :name="customer.name" :src="customer.avatarUrl" :size="44" />
      <span class="cust-item__body">
        <span class="cust-item__row">
          <span class="cust-item__name">{{ customer.name }}</span>
          <span class="cust-item__time">
            {{
              customer.lastContactAt
                ? relativeTime(customer.lastContactAt, Date.now(), i18n.locale)
                : i18n.t('customers.neverContacted')
            }}
          </span>
        </span>
        <span class="cust-item__row">
          <span class="cust-item__contact">{{ customer.phone || customer.email }}</span>
          <span class="cust-item__threads">{{ i18n.t('customers.threadCount', { n: customer.conversationCount }) }}</span>
        </span>
        <span v-if="customer.tags.length" class="cust-item__tags">
          <span
            v-for="tag in customer.tags"
            :key="tag.id"
            class="cust-item__tag"
            :style="{ background: `${tag.color}1f`, color: tag.color }"
          >{{ tag.name }}</span>
        </span>
      </span>
    </button>
    <template #right>
      <button class="cust-item__swipe" type="button" @click="emit('edit')">
        {{ i18n.t('customers.edit') }}
      </button>
      <button class="cust-item__swipe cust-item__swipe--warn" type="button" @click="emit('delete')">
        {{ i18n.t('customers.delete') }}
      </button>
    </template>
  </van-swipe-cell>
</template>

<style scoped>
.cust-item {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.cust-item:hover {
  background: var(--ks-bg-muted);
}
.cust-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cust-item__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cust-item__name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cust-item__time {
  font-size: 11px;
  color: var(--ks-text-tertiary);
  flex-shrink: 0;
}
.cust-item__contact {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--ks-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cust-item__threads {
  font-size: 11px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 1px 8px;
  flex-shrink: 0;
}
.cust-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.cust-item__tag {
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 1px 8px;
}
.cust-item__swipe {
  height: 100%;
  border: none;
  padding: 0 18px;
  background: var(--ks-accent);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.cust-item__swipe--warn {
  background: var(--ks-error);
}
</style>