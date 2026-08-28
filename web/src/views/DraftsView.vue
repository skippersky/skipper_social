<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDraftsStore } from '../stores/drafts';

const router = useRouter();
const drafts = useDraftsStore();

onMounted(() => drafts.load());

function open(id: string): void {
  router.push({ path: '/editor', query: { draft: id } });
}

async function onDelete(id: string): Promise<void> {
  await drafts.remove(id);
}
</script>

<template>
  <div>
    <van-nav-bar title="草稿箱（离线可用）" />
    <van-empty v-if="drafts.drafts.length === 0" description="暂无草稿" />
    <van-swipe-cell v-for="d in drafts.drafts" :key="d.id">
      <van-cell
        :title="d.body.slice(0, 24) || '(空)'"
        :label="`${d.locale} · ${new Date(d.updatedAt).toLocaleString()}`"
        @click="open(d.id)"
      />
      <template #right>
        <van-button square type="danger" text="删除" @click="onDelete(d.id)" />
      </template>
    </van-swipe-cell>
  </div>
</template>
