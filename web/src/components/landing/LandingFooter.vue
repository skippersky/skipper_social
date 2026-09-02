<script setup lang="ts">
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();
const year = new Date().getFullYear();
</script>

<template>
  <footer class="lfooter">
    <div class="lfooter__inner">
      <div class="lfooter__brand">
        <span class="lfooter__logo" aria-hidden="true">K</span>
        <div>
          <p class="lfooter__name">KiliSocial</p>
          <p class="lfooter__tag">{{ i18n.t('landing.footerTagline') }}</p>
        </div>
      </div>
      <nav class="lfooter__links" aria-label="footer">
        <router-link to="/pricing">{{ i18n.t('nav.pricing') }}</router-link>
        <router-link to="/privacy">{{ i18n.t('legal.privacyTitle') }}</router-link>
        <router-link to="/terms">{{ i18n.t('legal.termsTitle') }}</router-link>
        <a href="mailto:hello@kilisocial.app">{{ i18n.t('landing.contact') }}</a>
      </nav>
      <p class="lfooter__rights">{{ year }} KiliSocial. {{ i18n.t('landing.rights') }}</p>
    </div>
  </footer>
</template>

<style scoped>
.lfooter {
  background: #171A21;
  color: rgba(255, 255, 255, 0.82);
}
.lfooter__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 20px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
}
.lfooter__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: auto;
}
.lfooter__logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-family: Sora, sans-serif;
  font-weight: 800;
  font-size: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lfooter__name {
  margin: 0;
  font-family: Sora, sans-serif;
  font-weight: 700;
  font-size: 15px;
  color: #FFFFFF;
}
.lfooter__tag {
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}
.lfooter__links {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.lfooter__links a {
  color: rgba(255, 255, 255, 0.82);
  text-decoration: none;
  font-size: 13px;
}
.lfooter__links a:hover {
  color: #FFB238;
}
.lfooter__rights {
  width: 100%;
  margin: 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
</style>