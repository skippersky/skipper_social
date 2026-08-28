<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; src?: string; size?: number }>(), {
  size: 48
});

const FALLBACK_COLORS = ['#E8A33D', '#E08B62', '#D9B36C'];

const background = computed(
  () => FALLBACK_COLORS[(props.name.charCodeAt(0) || 0) % FALLBACK_COLORS.length]
);
const initial = computed(() => (props.name.trim().charAt(0) || '?').toUpperCase());
const fontSize = computed(() => `${Math.round(props.size * 0.42)}px`);
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="name"
    class="ks-avatar"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
  <span
    v-else
    class="ks-avatar ks-avatar--fallback"
    :style="{ width: `${size}px`, height: `${size}px`, background, fontSize }"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
</template>

<style scoped>
.ks-avatar {
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  object-fit: cover;
}
.ks-avatar--fallback {
  color: var(--ks-primary-ink);
  font-weight: 600;
  font-family: Sora, "PingFang SC", sans-serif;
}
</style>