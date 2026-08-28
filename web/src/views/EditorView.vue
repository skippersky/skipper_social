<script setup lang="ts">
import { showToast } from 'vant';
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { CONTENT_UNAVAILABLE, generateCopywriting } from '../api/copywriting';
import { useDraftsStore, type DraftLocale } from '../stores/drafts';

const route = useRoute();
const drafts = useDraftsStore();
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
    showToast('先输入内容再生成');
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
      showToast('AI 服务暂不可用，已保留原文');
    } else {
      body.value = copy;
      showToast('生成完成');
    }
  } catch {
    showToast('AI 服务暂不可用，已保留原文');
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
  showToast('草稿已保存，离线可用');
}
</script>

<template>
  <div>
    <van-nav-bar title="消息编辑器" />
    <van-radio-group v-model="locale" direction="horizontal" class="locale">
      <van-radio name="sw">Swahili</van-radio>
      <van-radio name="en">English</van-radio>
    </van-radio-group>
    <van-field
      v-model="body"
      type="textarea"
      rows="6"
      maxlength="500"
      show-word-limit
      placeholder="输入要发布的内容…"
    />
    <div class="actions">
      <van-button type="primary" plain :loading="aiLoading" loading-text="生成中…" @click="onAi">
        AI 文案
      </van-button>
      <van-button type="primary" @click="onSave">存草稿</van-button>
    </div>
    <van-notice-bar text="第三方平台账号审核中，发布功能稍后开放" />
  </div>
</template>

<style scoped>
.locale {
  margin: 12px 16px;
}
.actions {
  display: flex;
  gap: 12px;
  margin: 12px 16px;
}
.actions .van-button {
  flex: 1;
}
</style>
