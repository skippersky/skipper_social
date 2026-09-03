<script setup lang="ts">
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();
</script>

<template>
  <div class="limit-warning" role="alert">
    <p class="limit-warning__text">{{ i18n.t('channels.limitReached') }}</p>
    <router-link to="/dashboard/subscription/upgrade" class="limit-warning__link">
      {{ i18n.t('channels.limitUpgrade') }}
    </router-link>
  </div>
</template>

<style scoped>
.limit-warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(180, 83, 9, 0.08);
}
.limit-warning__text {
  margin: 0;
  color: var(--ks-warning);
  font-size: 13px;
  font-weight: 600;
}
.limit-warning__link {
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
</style>