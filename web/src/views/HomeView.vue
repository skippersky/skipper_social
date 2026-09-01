<script setup lang="ts">
import KsAvatar from '../components/KsAvatar.vue';
import { useI18nStore } from '../i18n';

const i18n = useI18nStore();
</script>

<template>
  <div class="home">
    <section class="home__hero">
      <div class="home__hero-inner">
        <div class="home__hero-copy">
          <p class="home__overline">{{ i18n.t('home.overline') }}</p>
          <h1 class="home__title">{{ i18n.t('home.title') }}</h1>
          <p class="home__subtitle">{{ i18n.t('home.subtitle') }}</p>
          <div class="home__cta">
            <router-link to="/chat" class="home__cta-primary">
              {{ i18n.t('home.cta') }}
            </router-link>
            <router-link to="/editor" class="home__cta-secondary">
              {{ i18n.t('home.ctaSecondary') }}
            </router-link>
          </div>
        </div>
        <div class="home__hero-panel" aria-hidden="true">
          <div class="preview-card">
            <div class="preview-card__head">
              <KsAvatar name="Amani Juma" :size="40" />
              <div>
                <p class="preview-card__name">{{ i18n.t('home.previewName') }}</p>
                <p class="preview-card__status"><span class="dot dot--online"></span>WhatsApp</p>
              </div>
            </div>
            <div class="preview-card__bubble preview-card__bubble--in">
              {{ i18n.t('home.previewIncoming') }}
            </div>
            <div class="preview-card__bubble preview-card__bubble--out">
              {{ i18n.t('home.previewOutgoing') }}
            </div>
            <div class="preview-card__composer"></div>
          </div>
        </div>
      </div>
      <div class="home__pattern" aria-hidden="true"></div>
    </section>

    <section class="home__features">
      <router-link class="feature" to="/chat">
        <span class="feature__icon feature__icon--chat" aria-hidden="true"></span>
        <span class="feature__title">{{ i18n.t('home.entryChatTitle') }}</span>
        <span class="feature__desc">{{ i18n.t('home.entryChatDesc') }}</span>
      </router-link>
      <router-link class="feature" to="/editor">
        <span class="feature__icon feature__icon--spark" aria-hidden="true"></span>
        <span class="feature__title">{{ i18n.t('home.entryEditorTitle') }}</span>
        <span class="feature__desc">{{ i18n.t('home.entryEditorDesc') }}</span>
      </router-link>
      <router-link class="feature" to="/drafts">
        <span class="feature__icon feature__icon--draft" aria-hidden="true"></span>
        <span class="feature__title">{{ i18n.t('home.entryDraftsTitle') }}</span>
        <span class="feature__desc">{{ i18n.t('home.entryDraftsDesc') }}</span>
      </router-link>
    </section>

    <p class="home__notice">{{ i18n.t('home.notice') }}</p>
  </div>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.home__hero {
  position: relative;
  background:
    radial-gradient(52rem 24rem at 85% -10%, rgba(255, 178, 56, 0.16), transparent 65%),
    radial-gradient(40rem 20rem at 8% 0%, rgba(91, 91, 214, 0.10), transparent 60%),
    var(--ks-bg-base);
  overflow: hidden;
}
.home__hero-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 72px 24px 88px;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 48px;
  align-items: center;
}
.home__overline {
  margin: 0 0 14px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ks-primary-text);
}
.home__title {
  font-size: 32px;
  line-height: 40px;
  font-weight: 700;
  max-width: 30rem;
}
.home__subtitle {
  margin: 16px 0 28px;
  font-size: 16px;
  line-height: 24px;
  color: var(--ks-text-secondary);
  max-width: 28rem;
}
.home__cta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.home__cta-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 24px;
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-weight: 600;
  text-decoration: none;
  transition: transform var(--ks-motion-fast) var(--ks-ease),
    box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.home__cta-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(244, 99, 58, 0.25);
}
.home__cta-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 24px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-weight: 500;
  text-decoration: none;
  transition: border-color var(--ks-motion-fast) var(--ks-ease);
}
.home__cta-secondary:hover {
  border-color: var(--ks-primary);
}
.home__hero-panel {
  display: flex;
  justify-content: center;
}
.preview-card {
  width: 100%;
  max-width: 400px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: 18px;
  box-shadow: var(--ks-shadow-float);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.preview-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.preview-card__name {
  margin: 0;
  font-weight: 600;
  font-size: 15px;
  color: var(--ks-text-primary);
}
.preview-card__status {
  margin: 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot--online {
  background: var(--ks-success);
}
.preview-card__bubble {
  max-width: 85%;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 21px;
}
.preview-card__bubble--in {
  align-self: flex-start;
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
  border-radius: 16px 16px 16px 4px;
}
.preview-card__bubble--out {
  align-self: flex-end;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  border-radius: 16px 16px 4px 16px;
}
.preview-card__composer {
  height: 40px;
  border-radius: 10px;
  background: var(--ks-bg-muted);
}
.home__pattern {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28px;
  opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='28' viewBox='0 0 56 28'%3E%3Cpath d='M0 28 L14 8 L28 28 Z' fill='%23F4633A' fill-opacity='0.10'/%3E%3Cpath d='M28 28 L42 8 L56 28 Z' fill='%235B5BD6' fill-opacity='0.08'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
}
.home__features {
  max-width: 1120px;
  width: 100%;
  margin: 0 auto;
  padding: 40px 24px 8px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border-radius: var(--ks-radius-card);
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
  text-decoration: none;
  transition: transform var(--ks-motion-fast) var(--ks-ease),
    box-shadow var(--ks-motion-fast) var(--ks-ease),
    border-color var(--ks-motion-fast) var(--ks-ease);
}
.feature:hover {
  transform: translateY(-2px);
  border-color: var(--ks-border-strong);
  box-shadow: 0 12px 32px rgba(23, 26, 33, 0.10);
}
.feature__icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--ks-grad-soft);
  position: relative;
}
.feature__icon::after {
  content: "";
  position: absolute;
  inset: 12px;
  border-radius: 4px;
}
.feature__icon--chat::after {
  background: var(--ks-primary);
  border-radius: 8px 8px 2px 8px;
}
.feature__icon--spark::after {
  background: linear-gradient(135deg, #FFB238, #F4633A);
  clip-path: polygon(50% 0, 63% 37%, 100% 50%, 63% 63%, 50% 100%, 37% 63%, 0 50%, 37% 37%);
  border-radius: 0;
}
.feature__icon--draft::after {
  background: var(--ks-accent);
  clip-path: polygon(0 0, 70% 0, 100% 30%, 100% 100%, 0 100%);
  border-radius: 0;
}
.feature__title {
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.feature__desc {
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.home__notice {
  max-width: 1120px;
  width: 100%;
  margin: 24px auto 40px;
  padding: 0 24px;
  font-size: 13px;
  line-height: 20px;
  color: var(--ks-warning);
}
@media (max-width: 1023px) {
  .home__hero-inner {
    grid-template-columns: 1fr;
    padding: 48px 24px 72px;
    gap: 36px;
  }
  .home__features {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 767px) {
  .home__title {
    font-size: 26px;
    line-height: 32px;
  }
}
</style>