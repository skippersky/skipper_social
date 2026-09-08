<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import ConversationItem from '../../../components/conversation/ConversationItem.vue';
import CustomerCard from '../../../components/customer/CustomerCard.vue';
import CustomerForm from '../../../components/customer/CustomerForm.vue';
import CustomerStats from '../../../components/customer/CustomerStats.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useCustomer } from '../../../composables/useCustomer';
import { useCustomerTags } from '../../../composables/useCustomerTags';
import { useI18nStore } from '../../../i18n';
import { useCustomerStore } from '../../../stores/customer';
import type { CustomerInput } from '../../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();
const store = useCustomerStore();

const customerId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null));
const { customer, stats, conversations, loading, loadAll, updateCustomer, deleteCustomer } =
  useCustomer(customerId);
const { tags, loadTags, assignTag, removeTag } = useCustomerTags();

usePageMeta(i18n.t('customers.metaTitle'), i18n.t('customers.metaDescription'));

onMounted(() => {
  void loadAll();
  void loadTags();
});

const editShow = ref(false);
const submitting = ref(false);
const tagShow = ref(false);
const deleteShow = ref(false);

const unassignedTags = computed(() => {
  const owned = new Set((customer.value?.tags ?? []).map((tag) => tag.id));
  return tags.value.filter((tag) => !owned.has(tag.id));
});

async function onSave(input: CustomerInput): Promise<void> {
  submitting.value = true;
  try {
    if (await updateCustomer(input)) {
      editShow.value = false;
      showToast(i18n.t('customers.updatedToast'));
    } else if (store.error) {
      showToast(i18n.t(store.error));
    }
  } finally {
    submitting.value = false;
  }
}

async function onRemoveTag(tagId: string): Promise<void> {
  if (!customer.value) return;
  if (!(await removeTag(customer.value.id, tagId))) showToast(i18n.t('api.network'));
}

async function onAssignTag(tagId: string): Promise<void> {
  if (!customer.value) return;
  if (await assignTag(customer.value.id, tagId)) tagShow.value = false;
  else showToast(i18n.t('api.network'));
}

async function onDelete(): Promise<void> {
  if (await deleteCustomer()) {
    showToast(i18n.t('customers.deletedToast'));
    await router.push('/dashboard/customers');
  } else if (store.error) {
    showToast(i18n.t(store.error));
  }
}

function openConversation(conversationId: string): void {
  void router.push({ path: '/dashboard/conversations', query: { open: conversationId } });
}
</script>

<template>
  <section class="cust-detail">
    <header class="cust-detail__top">
      <button
        class="cust-detail__back"
        type="button"
        :aria-label="i18n.t('customers.backToList')"
        @click="router.push('/dashboard/customers')"
      >&larr;</button>
      <h1 class="cust-detail__heading">{{ i18n.t('customers.title') }}</h1>
    </header>

    <div v-if="loading && !customer" class="cust-detail__loading">&hellip;</div>
    <div v-else-if="!customer" class="cust-detail__missing">
      <van-empty :description="i18n.t('customers.notFound')">
        <button class="cust-detail__cta" type="button" @click="router.push('/dashboard/customers')">
          {{ i18n.t('customers.backToList') }}
        </button>
      </van-empty>
    </div>
    <div v-else class="cust-detail__body">
      <CustomerCard
        :customer="customer"
        @edit="editShow = true"
        @delete="deleteShow = true"
        @remove-tag="onRemoveTag"
        @add-tag="tagShow = true"
      />
      <CustomerStats :stats="stats" :loading="loading" />
      <section class="cust-detail__history">
        <h2 class="cust-detail__history-title">{{ i18n.t('customers.historyTitle') }}</h2>
        <p v-if="!conversations.length" class="cust-detail__history-empty">
          {{ i18n.t('customers.historyEmpty') }}
        </p>
        <div v-else class="cust-detail__history-list">
          <ConversationItem
            v-for="conversation in conversations"
            :key="conversation.id"
            :conversation="conversation"
            :selected="false"
            @select="openConversation(conversation.id)"
          />
        </div>
      </section>
    </div>

    <van-popup v-model:show="editShow" position="bottom" round :style="{ maxHeight: '85%' }">
      <CustomerForm
        :tags="tags"
        :customer="customer"
        :submitting="submitting"
        @submit="onSave"
        @cancel="editShow = false"
      />
    </van-popup>

    <van-popup v-model:show="tagShow" position="bottom" round :style="{ maxHeight: '60%' }">
      <div class="cust-detail__tag-picker">
        <p class="cust-detail__tag-title">{{ i18n.t('tags.assign') }}</p>
        <p v-if="!unassignedTags.length" class="cust-detail__tag-empty">{{ i18n.t('tags.empty') }}</p>
        <button
          v-for="tag in unassignedTags"
          :key="tag.id"
          class="cust-detail__tag-option"
          :style="{ background: `${tag.color}1f`, color: tag.color }"
          type="button"
          @click="onAssignTag(tag.id)"
        >{{ tag.name }}</button>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="deleteShow"
      :title="i18n.t('customers.deleteTitle')"
      show-cancel-button
      :confirm-button-text="i18n.t('customers.deleteConfirmBtn')"
      :cancel-button-text="i18n.t('customers.cancel')"
      @confirm="onDelete"
    >
      <p class="cust-detail__confirm-text">{{ i18n.t('customers.deleteText') }}</p>
    </van-dialog>
  </section>
</template>

<style scoped>
.cust-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 24px 40px;
  box-sizing: border-box;
  background: var(--ks-bg-base);
}
.cust-detail__top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.cust-detail__back {
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.cust-detail__back:hover {
  background: var(--ks-bg-muted);
}
.cust-detail__heading {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.cust-detail__loading {
  padding: 48px 16px;
  text-align: center;
  color: var(--ks-text-tertiary);
}
.cust-detail__missing {
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}
.cust-detail__cta {
  height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.cust-detail__body {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 4fr);
  grid-template-areas:
    'card stats'
    'history history';
  gap: 16px;
  align-items: start;
}
.cust-detail__body > :deep(.cust-card) {
  grid-area: card;
}
.cust-detail__body > :deep(.cust-stats) {
  grid-area: stats;
}
.cust-detail__history {
  grid-area: history;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 16px 4px 8px;
}
.cust-detail__history-title {
  margin: 0 0 8px;
  padding: 0 16px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.cust-detail__history-empty {
  margin: 0;
  padding: 12px 16px 20px;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.cust-detail__history-list > :deep(:not(:last-child)) {
  border-bottom: 1px solid var(--ks-border-default);
}
.cust-detail__tag-picker {
  padding: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cust-detail__tag-title {
  width: 100%;
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
}
.cust-detail__tag-empty {
  width: 100%;
  margin: 0;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.cust-detail__tag-option {
  border: none;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.cust-detail__confirm-text {
  margin: 0;
  padding: 20px 24px;
  font-size: 14px;
  color: var(--ks-text-secondary);
}
@media (max-width: 1023px) {
  .cust-detail__body {
    grid-template-columns: 1fr;
    grid-template-areas:
      'card'
      'stats'
      'history';
  }
}
@media (max-width: 767px) {
  .cust-detail {
    padding: 14px 14px 32px;
  }
}
</style>