<script setup lang="ts">
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import type { Customer } from '../../types';

defineProps<{ customer: Customer }>();

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'removeTag', tagId: string): void;
  (e: 'addTag'): void;
}>();

const i18n = useI18nStore();
</script>

<template>
  <section class="cust-card">
    <header class="cust-card__head">
      <KsAvatar :name="customer.name" :src="customer.avatarUrl" :size="72" />
      <div class="cust-card__heading">
        <h1 class="cust-card__name">{{ customer.name }}</h1>
        <div class="cust-card__actions">
          <button class="cust-card__btn" type="button" @click="emit('edit')">
            {{ i18n.t('customers.edit') }}
          </button>
          <button class="cust-card__btn cust-card__btn--danger" type="button" @click="emit('delete')">
            {{ i18n.t('customers.delete') }}
          </button>
        </div>
      </div>
    </header>
    <dl class="cust-card__meta">
      <div v-if="customer.phone" class="cust-card__meta-row">
        <dt>{{ i18n.t('customers.fieldPhone') }}</dt>
        <dd>{{ customer.phone }}</dd>
      </div>
      <div v-if="customer.email" class="cust-card__meta-row">
        <dt>{{ i18n.t('customers.fieldEmail') }}</dt>
        <dd>{{ customer.email }}</dd>
      </div>
      <div v-if="customer.address" class="cust-card__meta-row">
        <dt>{{ i18n.t('customers.fieldAddress') }}</dt>
        <dd>{{ customer.address }}</dd>
      </div>
      <div v-if="customer.notes" class="cust-card__meta-row">
        <dt>{{ i18n.t('customers.fieldNotes') }}</dt>
        <dd class="cust-card__notes">{{ customer.notes }}</dd>
      </div>
    </dl>
    <div class="cust-card__tags">
      <span
        v-for="tag in customer.tags"
        :key="tag.id"
        class="cust-card__tag"
        :style="{ background: `${tag.color}1f`, color: tag.color }"
      >
        {{ tag.name }}
        <button
          class="cust-card__tag-x"
          type="button"
          :aria-label="`${i18n.t('tags.remove')} ${tag.name}`"
          @click="emit('removeTag', tag.id)"
        >&times;</button>
      </span>
      <button class="cust-card__tag-add" type="button" @click="emit('addTag')">
        + {{ i18n.t('tags.assign') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.cust-card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cust-card__head {
  display: flex;
  align-items: center;
  gap: 16px;
}
.cust-card__heading {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.cust-card__name {
  margin: 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.cust-card__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.cust-card__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.cust-card__btn:hover {
  background: var(--ks-bg-muted);
}
.cust-card__btn--danger {
  color: var(--ks-error);
  border-color: rgba(220, 38, 38, 0.35);
}
.cust-card__btn--danger:hover {
  background: rgba(220, 38, 38, 0.06);
}
.cust-card__meta {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 24px;
}
.cust-card__meta-row {
  min-width: 0;
}
.cust-card__meta-row dt {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.cust-card__meta-row dd {
  margin: 2px 0 0;
  font-size: 14px;
  color: var(--ks-text-primary);
  word-break: break-word;
}
.cust-card__notes {
  color: var(--ks-text-secondary);
}
.cust-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cust-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  padding: 4px 10px;
}
.cust-card__tag-x {
  border: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}
.cust-card__tag-add {
  border: 1px dashed var(--ks-border-strong);
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
}
.cust-card__tag-add:hover {
  border-color: var(--ks-primary-text);
  color: var(--ks-primary-text);
}
</style>