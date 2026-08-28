<script setup lang="ts">
</script>

<template>
  <div class="app-shell">
    <router-view />
    <van-tabbar route>
      <van-tabbar-item to="/editor" icon="edit">编辑</van-tabbar-item>
      <van-tabbar-item to="/drafts" icon="notes">草稿箱</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<style>
body {
  margin: 0;
  background: #f7f8fa;
}
.app-shell {
  padding-bottom: 60px;
}
</style>
