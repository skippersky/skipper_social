<script setup lang="ts">
import { nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import LandingFooter from '../components/landing/LandingFooter.vue';
import LandingHeader from '../components/landing/LandingHeader.vue';

const route = useRoute();

// Landing pages own their scrolling: top on path change, anchor on hash.
watch(
  () => route.fullPath,
  async () => {
    if (typeof window === 'undefined') return;
    await nextTick();
    if (route.hash) {
      document.querySelector(route.hash)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0 });
    }
  }
);
</script>

<template>
  <div class="landing-shell">
    <LandingHeader />
    <main class="landing-shell__main">
      <router-view />
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
.landing-shell {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
.landing-shell__main {
  flex: 1;
}
</style>