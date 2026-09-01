<script setup lang="ts">
import { showToast } from 'vant';
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CONTENT_UNAVAILABLE, generateCopywriting } from '../api/copywriting';
import { useI18nStore } from '../i18n';
import { useDraftsStore, type DraftLocale } from '../stores/drafts';

const route = useRoute();
const router = useRouter();
const drafts = useDraftsStore();
const i18n = useI18nStore();
const body = ref('');
const locale = ref<DraftLocale>('sw');
const aiLoading = ref(false);

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `d-${Date.now()}`;
}

onMounted(async () => {
  await drafts.load();
  const id = route.query.draft as string | undefined;
  if (id) {
    const draft = drafts.get(id);
    if (draft) {
      body.value = draft.body;
      locale.value = draft.locale;
    }
  }
});

async function onAi(): Promise<void> {
  if (!body.value.trim()) {
    showToast(i18n.t('editor.emptyFirst'));
    return;
  }
  aiLoading.value = true;
  try {
    const copy = await generateCopywriting({
      locale: locale.value,
      contentType: 'social_post',
      variables: { content: body.value }
    });
    if (copy === CONTENT_UNAVAILABLE) {
      showToast(i18n.t('editor.aiUnavailable'));
    } else {
      body.value = copy;
      showToast(i18n.t('editor.aiDone'));
    }
  } catch {
    showToast(i18n.t('editor.aiUnavailable'));
  } finally {
    aiLoading.value = false;
  }
}

async function onSave(): Promise<void> {
  const existing = route.query.draft as string | undefined;
  await drafts.save({
    id: existing ?? newId(),
    body: body.value,
    locale: locale.value,
    contentType: 'social_post',
    updatedAt: Date.now()
  });
  showToast(i18n.t('editor.saved'));
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <button class="page__home" type="button" :aria-label="i18n.t('common.backHome')" @click="router.push('/')">←</button>
      <h2 class="page__title">{{ i18n.t('editor.title') }}</h2>
    </header>
    <div class="workspace">
      <section class="card editor-card">
        <van-radio-group v-model="locale" direction="horizontal" class="locale">
          <van-radio name="sw">Swahili</van-radio>
          <van-radio name="en">English</van-radio>
        </van-radio-group>
        <van-field
          v-model="body"
          type="textarea"
          rows="8"
          maxlength="500"
          show-word-limit
          :placeholder="i18n.t('editor.placeholder')"
        />
        <div class="actions">
          <van-button type="primary" plain :loading="aiLoading" :loading-text="i18n.t('editor.generating')" @click="onAi">
            {{ i18n.t('editor.ai') }}
          </van-button>
          <van-button type="primary" @click="onSave">{{ i18n.t('editor.save') }}</van-button>
        </div>
      </section>
      <aside class="card side-card">
        <h3 class="side-card__title">{{ i18n.t('editor.sideTitle') }}</h3>
        <van-notice-bar :text="i18n.t('home.notice')" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 24px 48px;
}
.page__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.page__home {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-secondary);
  font-size: 18px;
  cursor: pointer;
}
.page__home:hover {
  background: var(--ks-bg-muted);
}
.page__title {
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.workspace {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  align-items: start;
}
.card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
}
.editor-card {
  padding: 20px;
}
.locale {
  margin: 0 0 14px;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.actions .van-button {
  flex: 1;
  height: 44px;
}
.side-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.side-card__title {
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}
@media (max-width: 1023px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>