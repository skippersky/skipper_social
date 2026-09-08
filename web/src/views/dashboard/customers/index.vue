<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import CustomerForm from '../../../components/customer/CustomerForm.vue';
import CustomerList from '../../../components/customer/CustomerList.vue';
import TagManager from '../../../components/customer/TagManager.vue';
import { usePageMeta } from '../../../composables/usePageMeta';
import { useCustomerList } from '../../../composables/useCustomerList';
import { useCustomerTags } from '../../../composables/useCustomerTags';
import { useI18nStore } from '../../../i18n';
import { useCustomerStore } from '../../../stores/customer';
import { CHANNEL_PLATFORMS, type Customer, type CustomerInput } from '../../../types';

const i18n = useI18nStore();
const router = useRouter();
const store = useCustomerStore();

usePageMeta(i18n.t('customers.metaTitle'), i18n.t('customers.metaDescription'));

const {
  customers,
  loading,
  hasMore,
  total,
  filters,
  search,
  filterByTag,
  filterByChannel,
  loadMore,
  refresh
} = useCustomerList();
const {
  tags,
  error: tagError,
  loadTags,
  createTag,
  updateTag,
  deleteTag
} = useCustomerTags();

/* Sample-data disclosure, mirroring the inbox: hiding it collapses the demo rows. */
const DEMO_HIDDEN_KEY = 'ks-customers-demo-hidden';
const demoHidden = ref(false);
const showDemoBar = computed(() => store.hasDemoData && !demoHidden.value);
const visibleCustomers = computed(() =>
  store.hasDemoData && demoHidden.value ? [] : customers.value
);

function hideDemo(): void {
  demoHidden.value = true;
  try {
    localStorage.setItem(DEMO_HIDDEN_KEY, '1');
  } catch {
    /* private mode */
  }
}

onMounted(() => {
  try {
    demoHidden.value = localStorage.getItem(DEMO_HIDDEN_KEY) === '1';
  } catch {
    /* private mode */
  }
  void refresh();
  void loadTags();
});

const formShow = ref(false);
const editing = ref<Customer | null>(null);
const submitting = ref(false);
const tagsShow = ref(false);
const pendingDelete = ref<Customer | null>(null);

const deleteShow = computed({
  get: () => pendingDelete.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDelete.value = null;
  }
});

const isEmpty = computed(() => !loading.value && visibleCustomers.value.length === 0);

function onSearchInput(event: Event): void {
  store.setFilters({ query: (event.target as HTMLInputElement).value });
}

async function onSearchSubmit(): Promise<void> {
  await search(store.filters.query);
}

function openCreate(): void {
  editing.value = null;
  formShow.value = true;
}

function openEdit(id: string): void {
  editing.value = customers.value.find((customer) => customer.id === id) ?? null;
  if (editing.value) formShow.value = true;
}

async function onSubmitForm(input: CustomerInput): Promise<void> {
  submitting.value = true;
  try {
    const editingNow = editing.value;
    const ok = editingNow
      ? await store.updateCustomer(editingNow.id, input)
      : await store.createCustomer(input);
    if (ok) {
      formShow.value = false;
      showToast(i18n.t(editingNow ? 'customers.updatedToast' : 'customers.createdToast'));
    } else if (store.error) {
      showToast(i18n.t(store.error));
    }
  } finally {
    submitting.value = false;
  }
}

function requestDelete(id: string): void {
  pendingDelete.value = customers.value.find((customer) => customer.id === id) ?? null;
}

async function confirmDelete(): Promise<void> {
  const target = pendingDelete.value;
  pendingDelete.value = null;
  if (!target) return;
  if (await store.deleteCustomer(target.id)) showToast(i18n.t('customers.deletedToast'));
  else if (store.error) showToast(i18n.t(store.error));
}

async function onTagCreate(name: string, color: string): Promise<void> {
  const tag = await createTag(name, color);
  if (tag) showToast(i18n.t('tags.savedToast'));
  else if (tagError.value) showToast(i18n.t(tagError.value));
}

async function onTagUpdate(id: string, patch: { name: string; color: string }): Promise<void> {
  if (await updateTag(id, patch)) showToast(i18n.t('tags.updatedToast'));
  else if (tagError.value) showToast(i18n.t(tagError.value));
}

async function onTagDelete(id: string): Promise<void> {
  if (await deleteTag(id)) showToast(i18n.t('tags.deletedToast'));
  else if (tagError.value) showToast(i18n.t(tagError.value));
}

function openDetail(id: string): void {
  void router.push(`/dashboard/customers/${id}`);
}

/** Infinite scroll: fetch the next page near the bottom of the list pane. */
function onListScroll(event: Event): void {
  const el = event.target as HTMLElement;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) void loadMore();
}
</script>

<template>
  <section class="customers">
    <header class="customers__top">
      <button
        class="customers__home"
        type="button"
        :aria-label="i18n.t('common.backHome')"
        @click="router.push('/home')"
      >&larr;</button>
      <h1 class="customers__title">{{ i18n.t('customers.title') }}</h1>
      <span class="customers__count">{{ total }}</span>
    </header>

    <div class="customers__toolbar">
      <form class="customers__search" @submit.prevent="onSearchSubmit">
        <input
          class="customers__search-input"
          :value="filters.query"
          :placeholder="i18n.t('customers.search')"
          :aria-label="i18n.t('customers.search')"
          @input="onSearchInput"
        />
      </form>
      <div class="customers__actions">
        <button class="customers__btn" type="button" @click="tagsShow = true">
          {{ i18n.t('customers.manageTags') }}
        </button>
        <button class="customers__btn customers__btn--primary" type="button" @click="openCreate">
          {{ i18n.t('customers.newCustomer') }}
        </button>
      </div>
    </div>

    <div class="customers__filters">
      <div class="customers__chips">
        <button
          class="customers__chip"
          :class="{ 'is-active': filters.tagId === 'all' }"
          type="button"
          @click="filterByTag('all')"
        >{{ i18n.t('customers.allTags') }}</button>
        <button
          v-for="tag in tags"
          :key="tag.id"
          class="customers__chip"
          :class="{ 'is-active': filters.tagId === tag.id }"
          :style="filters.tagId === tag.id ? { background: `${tag.color}29`, color: tag.color, borderColor: tag.color } : undefined"
          type="button"
          @click="filterByTag(tag.id)"
        >{{ tag.name }}</button>
      </div>
      <div class="customers__chips">
        <button
          class="customers__chip"
          :class="{ 'is-active': filters.channel === 'all' }"
          type="button"
          @click="filterByChannel('all')"
        >{{ i18n.t('inbox.platformAll') }}</button>
        <button
          v-for="platform in CHANNEL_PLATFORMS"
          :key="platform"
          class="customers__chip"
          :class="{ 'is-active': filters.channel === platform }"
          type="button"
          @click="filterByChannel(platform)"
        >{{ i18n.t(`channels.platform.${platform}`) }}</button>
      </div>
    </div>

    <div v-if="showDemoBar" class="customers__demo" role="note">
      <span>{{ i18n.t('customers.demoNotice') }}</span>
      <button type="button" :aria-label="i18n.t('customers.demoHide')" @click="hideDemo">&times;</button>
    </div>

    <div v-if="loading && !visibleCustomers.length" class="customers__loading">&hellip;</div>
    <div v-else-if="isEmpty" class="customers__empty">
      <van-empty :description="i18n.t('customers.empty')">
        <p class="customers__empty-hint">{{ i18n.t('customers.emptyHint') }}</p>
        <button class="customers__empty-cta" type="button" @click="openCreate">
          {{ i18n.t('customers.newCustomer') }}
        </button>
      </van-empty>
    </div>
    <div v-else class="customers__scroll" @scroll.passive="onListScroll">
      <CustomerList
        :customers="visibleCustomers"
        @select="openDetail"
        @edit="openEdit"
        @delete="requestDelete"
      />
      <button
        v-if="hasMore"
        class="customers__more"
        type="button"
        :disabled="loading"
        @click="loadMore"
      >{{ i18n.t('customers.loadMore') }}</button>
    </div>

    <van-popup v-model:show="formShow" position="bottom" round :style="{ maxHeight: '85%' }">
      <CustomerForm
        :tags="tags"
        :customer="editing"
        :submitting="submitting"
        @submit="onSubmitForm"
        @cancel="formShow = false"
      />
    </van-popup>

    <van-popup v-model:show="tagsShow" position="bottom" round :style="{ maxHeight: '75%' }">
      <TagManager :tags="tags" @create="onTagCreate" @update="onTagUpdate" @delete="onTagDelete" />
    </van-popup>

    <van-dialog
      v-model:show="deleteShow"
      :title="i18n.t('customers.deleteTitle')"
      show-cancel-button
      :confirm-button-text="i18n.t('customers.deleteConfirmBtn')"
      :cancel-button-text="i18n.t('customers.cancel')"
      @confirm="confirmDelete"
    >
      <p class="customers__confirm-text">{{ i18n.t('customers.deleteText') }}</p>
    </van-dialog>
  </section>
</template>

<style scoped>
.customers {
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
.customers__top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.customers__home {
  width: 34px;
  height: 34px;
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 16px;
  cursor: pointer;
}
.customers__home:hover {
  background: var(--ks-bg-muted);
}
.customers__title {
  margin: 0;
  font-size: 22px;
  line-height: 30px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.customers__count {
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
  background: var(--ks-bg-muted);
  border-radius: 999px;
  padding: 2px 10px;
}
.customers__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.customers__search {
  flex: 1;
  min-width: 220px;
}
.customers__search-input {
  width: 100%;
  height: 40px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 14px;
  padding: 0 14px;
  box-sizing: border-box;
  font-family: inherit;
}
.customers__search-input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.customers__actions {
  display: flex;
  gap: 8px;
}
.customers__btn {
  height: 40px;
  padding: 0 16px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.customers__btn:hover {
  background: var(--ks-bg-muted);
}
.customers__btn--primary {
  border: none;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-weight: 700;
}
.customers__btn--primary:hover {
  filter: brightness(1.05);
}
.customers__filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}
.customers__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.customers__chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.customers__chip.is-active {
  background: var(--ks-grad-soft);
  border-color: var(--ks-primary-text);
  color: var(--ks-primary-text);
}
.customers__demo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-warning);
  background: rgba(180, 83, 9, 0.1);
  border: 1px solid rgba(180, 83, 9, 0.2);
  border-radius: var(--ks-radius-card);
}
.customers__demo button {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ks-warning);
  font-size: 14px;
  cursor: pointer;
}
.customers__demo button:hover {
  background: rgba(180, 83, 9, 0.15);
}
.customers__loading {
  padding: 32px 16px;
  text-align: center;
  color: var(--ks-text-tertiary);
}
.customers__empty {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.customers__empty-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-text-secondary);
}
.customers__empty-cta {
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
.customers__empty-cta:hover {
  filter: brightness(1.05);
}
.customers__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.customers__more {
  display: block;
  margin: 10px auto 14px;
  height: 32px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.customers__more:disabled {
  opacity: 0.5;
}
.customers__confirm-text {
  margin: 0;
  padding: 20px 24px;
  font-size: 14px;
  color: var(--ks-text-secondary);
}
@media (max-width: 767px) {
  .customers {
    padding: 14px 14px 32px;
  }
  .customers__search {
    min-width: 100%;
  }
  .customers__actions {
    width: 100%;
  }
  .customers__actions .customers__btn {
    flex: 1;
  }
}
</style>
