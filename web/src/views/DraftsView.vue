<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18nStore } from '../i18n';
import { useDraftsStore } from '../stores/drafts';

const router = useRouter();
const drafts = useDraftsStore();
const i18n = useI18nStore();

onMounted(() => drafts.load());

function open(id: string): void {
  router.push({ path: '/editor', query: { draft: id } });
}

async function onDelete(id: string): Promise<void> {
  await drafts.remove(id);
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <h2 class="page__title">{{ i18n.t('drafts.title') }}</h2>
    </header>
    <div class="card drafts-card">
      <van-empty v-if="drafts.drafts.length === 0" :description="i18n.t('drafts.empty')" />
      <van-swipe-cell v-for="d in drafts.drafts" :key="d.id">
        <van-cell
          :title="d.body.slice(0, 24) || '(empty)'"
          :label="`${d.locale} · ${new Date(d.updatedAt).toLocaleString()}`"
          @click="open(d.id)"
        />
        <template #right>
          <van-button square type="danger" :text="i18n.t('drafts.delete')" @click="onDelete(d.id)" />
        </template>
      </van-swipe-cell>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}
.page__head {
  margin-bottom: 20px;
}
.page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.drafts-card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  overflow: hidden;
}
</style>