<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const showTabbar = computed(() => ['/editor', '/drafts'].includes(route.path));
</script>

<template>
  <div class="app-shell" :class="{ 'app-shell--has-tabbar': showTabbar }">
    <router-view />
    <van-tabbar v-if="showTabbar" route>
      <van-tabbar-item to="/editor" icon="edit">编辑</van-tabbar-item>
      <van-tabbar-item to="/drafts" icon="notes">草稿箱</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
.app-shell {
  min-height: 100dvh;
}
.app-shell--has-tabbar {
  padding-bottom: 60px;
}
</style>