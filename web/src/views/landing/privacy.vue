<script setup lang="ts">
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();

usePageMeta(i18n.t('legal.privacyTitle'), i18n.t('legal.privacyMeta'));
</script>

<template>
  <article class="legal">
    <div class="legal__inner">
      <h1 class="legal__title">{{ i18n.t('legal.privacyTitle') }}</h1>
      <p class="legal__updated">{{ i18n.t('legal.updated') }}</p>
      <p class="legal__placeholder">{{ i18n.t('legal.placeholder') }}</p>
      <section v-for="n in 4" :key="n" class="legal__section">
        <h2>{{ i18n.t(`legal.privacyH${n}`) }}</h2>
        <p>{{ i18n.t('legal.privacyGeneric') }}</p>
      </section>
    </div>
  </article>
</template>

<style scoped>
.legal {
  background: var(--ks-bg-base);
  padding: 56px 20px 80px;
}
.legal__inner {
  max-width: 760px;
  margin: 0 auto;
}
.legal__title {
  font-size: 32px;
  line-height: 42px;
  font-weight: 800;
  margin: 0 0 8px;
}
.legal__updated {
  margin: 0 0 20px;
  color: var(--ks-text-tertiary);
  font-size: 13px;
}
.legal__placeholder {
  margin: 0 0 28px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 13px;
  line-height: 20px;
}
.legal__section {
  margin-bottom: 26px;
}
.legal__section h2 {
  font-size: 19px;
  line-height: 27px;
  font-weight: 600;
  margin: 0 0 8px;
}
.legal__section p {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 14px;
  line-height: 23px;
}
</style>