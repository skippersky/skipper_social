<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePageMeta } from '../../composables/usePageMeta';
import { useI18nStore } from '../../i18n';

const i18n = useI18nStore();

usePageMeta(i18n.t('landing.metaTitle'), i18n.t('landing.metaDescription'));

const activeFaq = ref<number[]>([0]);

const faqs = computed(() =>
  [1, 2, 3, 4, 5, 6].map((n) => ({
    q: i18n.t(`landing.q${n}`),
    a: i18n.t(`landing.a${n}`)
  }))
);
</script>

<template>
  <div class="landing">
    <section class="hero">
      <div class="hero__inner">
        <div class="hero__copy">
          <p class="hero__overline">{{ i18n.t('landing.heroOverline') }}</p>
          <h1 class="hero__title">{{ i18n.t('home.title') }}</h1>
          <p class="hero__subtitle">{{ i18n.t('home.subtitle') }}</p>
          <div class="hero__ctas">
            <router-link to="/register" class="btn btn--primary">{{ i18n.t('landing.cta') }}</router-link>
            <router-link to="/pricing" class="btn btn--ghost">{{ i18n.t('landing.ctaSecondary') }}</router-link>
          </div>
          <p class="hero__note">{{ i18n.t('home.notice') }}</p>
        </div>
        <div class="hero__mock" aria-hidden="true">
          <div class="mock">
            <div class="mock__head">
              <span class="mock__avatar">A</span>
              <span class="mock__name">{{ i18n.t('home.previewName') }}</span>
              <span class="mock__live"></span>
            </div>
            <div class="mock__msg mock__msg--in">{{ i18n.t('home.previewIncoming') }}</div>
            <div class="mock__msg mock__msg--out">{{ i18n.t('home.previewOutgoing') }}</div>
            <div class="mock__ai">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>
              {{ i18n.t('landing.aiChip') }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="features" class="section">
      <div class="section__inner">
        <h2 class="section__title">{{ i18n.t('landing.featuresTitle') }}</h2>
        <div class="features">
          <article class="feature">
            <span class="feature__icon feature__icon--amber">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>
            </span>
            <h3 class="feature__title">{{ i18n.t('landing.fAi') }}</h3>
            <p class="feature__desc">{{ i18n.t('landing.fAiDesc') }}</p>
          </article>
          <article class="feature">
            <span class="feature__icon feature__icon--coral">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.7 10.6l6.6-4.2M8.7 13.4l6.6 4.2"/></svg>
            </span>
            <h3 class="feature__title">{{ i18n.t('landing.fPublish') }}</h3>
            <p class="feature__desc">{{ i18n.t('landing.fPublishDesc') }}</p>
          </article>
          <article class="feature">
            <span class="feature__icon feature__icon--indigo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.8-.9L3 21l2-4.9a8.4 8.4 0 1 1 16-4.6z"/></svg>
            </span>
            <h3 class="feature__title">{{ i18n.t('landing.fInbox') }}</h3>
            <p class="feature__desc">{{ i18n.t('landing.fInboxDesc') }}</p>
          </article>
        </div>
      </div>
    </section>
    <section class="section section--muted">
      <div class="section__inner">
        <h2 class="section__title">{{ i18n.t('landing.howTitle') }}</h2>
        <ol class="steps">
          <li class="step">
            <span class="step__num">1</span>
            <h3 class="step__title">{{ i18n.t('landing.step1') }}</h3>
            <p class="step__desc">{{ i18n.t('landing.step1Desc') }}</p>
          </li>
          <li class="step">
            <span class="step__num">2</span>
            <h3 class="step__title">{{ i18n.t('landing.step2') }}</h3>
            <p class="step__desc">{{ i18n.t('landing.step2Desc') }}</p>
          </li>
          <li class="step">
            <span class="step__num">3</span>
            <h3 class="step__title">{{ i18n.t('landing.step3') }}</h3>
            <p class="step__desc">{{ i18n.t('landing.step3Desc') }}</p>
          </li>
          <li class="step">
            <span class="step__num">4</span>
            <h3 class="step__title">{{ i18n.t('landing.step4') }}</h3>
            <p class="step__desc">{{ i18n.t('landing.step4Desc') }}</p>
          </li>
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="section__inner">
        <h2 class="section__title">{{ i18n.t('landing.pricingTitle') }}</h2>
        <div class="plans-preview">
          <article class="plan-mini">
            <h3 class="plan-mini__name">Free</h3>
            <p class="plan-mini__price">$0<span>{{ i18n.t('pricing.month') }}</span></p>
            <p class="plan-mini__desc">{{ i18n.t('pricing.freeDesc') }}</p>
          </article>
          <article class="plan-mini plan-mini--featured">
            <h3 class="plan-mini__name">Basic</h3>
            <p class="plan-mini__price">$9<span>{{ i18n.t('pricing.month') }}</span></p>
            <p class="plan-mini__desc">{{ i18n.t('pricing.basicDesc') }}</p>
          </article>
          <article class="plan-mini">
            <h3 class="plan-mini__name">Pro</h3>
            <p class="plan-mini__price">$29<span>{{ i18n.t('pricing.month') }}</span></p>
            <p class="plan-mini__desc">{{ i18n.t('pricing.proDesc') }}</p>
          </article>
        </div>
        <div class="plans-cta">
          <router-link to="/pricing" class="btn btn--ghost">{{ i18n.t('landing.pricingCta') }}</router-link>
        </div>
      </div>
    </section>

    <section id="faq" class="section section--muted">
      <div class="section__inner section__inner--narrow">
        <h2 class="section__title">{{ i18n.t('landing.faqTitle') }}</h2>
        <van-collapse v-model="activeFaq" class="faq">
          <van-collapse-item v-for="(item, idx) in faqs" :key="idx" :name="idx" :title="item.q">
            {{ item.a }}
          </van-collapse-item>
        </van-collapse>
      </div>
    </section>
  </div>
</template>
<style scoped>
.landing {
  background: var(--ks-bg-base);
}
.hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(700px 340px at 88% -12%, rgba(255, 178, 56, 0.2), transparent 65%),
    radial-gradient(560px 300px at 6% 112%, rgba(91, 91, 214, 0.14), transparent 60%),
    var(--ks-bg-base);
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg, rgba(244, 99, 58, 0.05) 0 2px, transparent 2px 20px),
    repeating-linear-gradient(-45deg, rgba(91, 91, 214, 0.04) 0 2px, transparent 2px 20px);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 75%);
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 75%);
  pointer-events: none;
}
.hero__inner {
  position: relative;
  max-width: 1200px;
  margin: 0 auto;
  padding: 72px 20px 80px;
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 48px;
  align-items: center;
  min-height: 78vh;
  box-sizing: border-box;
}
.hero__overline {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ks-primary-text);
}
.hero__title {
  font-size: 46px;
  line-height: 56px;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 16px;
  background: linear-gradient(120deg, #171A21 55%, #C2410C 90%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero__subtitle {
  margin: 0 0 28px;
  max-width: 520px;
  color: var(--ks-text-secondary);
  font-size: 17px;
  line-height: 26px;
}
.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.hero__note {
  margin: 22px 0 0;
  font-size: 13px;
  color: var(--ks-warning);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  padding: 0 26px;
  border-radius: var(--ks-radius-btn);
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: filter var(--ks-motion-fast) var(--ks-ease), box-shadow var(--ks-motion-fast) var(--ks-ease);
}
.btn--primary {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.btn--primary:hover {
  filter: brightness(1.05);
  box-shadow: 0 10px 26px rgba(244, 99, 58, 0.3);
}
.btn--ghost {
  border: 1px solid var(--ks-border-strong);
  background: rgba(255, 255, 255, 0.7);
  color: var(--ks-text-primary);
}
.btn--ghost:hover {
  background: var(--ks-bg-muted);
}
.hero__mock {
  display: flex;
  justify-content: center;
}
.mock {
  width: 100%;
  max-width: 380px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transform: rotate(1.2deg);
}
.mock__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--ks-border-default);
}
.mock__avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #FFB238;
  color: #221507;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.mock__name {
  font-size: 14px;
  font-weight: 600;
}
.mock__live {
  margin-left: auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ks-success);
}
.mock__msg {
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 21px;
}
.mock__msg--in {
  align-self: flex-start;
  background: var(--ks-bg-muted);
  color: var(--ks-text-primary);
  border-bottom-left-radius: 4px;
}
.mock__msg--out {
  align-self: flex-end;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  border-bottom-right-radius: 4px;
}
.mock__ai {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(91, 91, 214, 0.1);
  color: var(--ks-accent);
  font-size: 12px;
  font-weight: 600;
}
.section {
  scroll-margin-top: 70px;
  padding: 72px 0;
}
.section--muted {
  background: var(--ks-bg-surface);
  border-top: 1px solid var(--ks-border-default);
  border-bottom: 1px solid var(--ks-border-default);
}
.section__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
.section__inner--narrow {
  max-width: 820px;
}
.section__title {
  font-size: 30px;
  line-height: 40px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 40px;
}
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.feature {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 26px 24px;
}
.feature__icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.feature__icon--amber {
  background: rgba(255, 178, 56, 0.16);
  color: #B45309;
}
.feature__icon--coral {
  background: rgba(244, 99, 58, 0.12);
  color: var(--ks-primary-text);
}
.feature__icon--indigo {
  background: rgba(91, 91, 214, 0.12);
  color: var(--ks-accent);
}
.feature__title {
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
  margin: 0 0 8px;
}
.feature__desc {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 14px;
  line-height: 22px;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  counter-reset: step;
}
.step {
  position: relative;
  background: var(--ks-bg-base);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  padding: 22px 20px;
}
.step__num {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  font-family: Sora, sans-serif;
  font-weight: 700;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}
.step__title {
  font-size: 15px;
  line-height: 23px;
  font-weight: 600;
  margin: 0 0 6px;
}
.step__desc {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.plans-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.plan-mini {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 26px 24px;
  text-align: center;
}
.plan-mini--featured {
  border: 2px solid var(--ks-primary);
  box-shadow: var(--ks-shadow-float);
}
.plan-mini__name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-secondary);
}
.plan-mini__price {
  margin: 10px 0 8px;
  font-family: Sora, sans-serif;
  font-size: 38px;
  font-weight: 800;
  color: var(--ks-text-primary);
}
.plan-mini__price span {
  font-size: 14px;
  font-weight: 500;
  color: var(--ks-text-tertiary);
}
.plan-mini__desc {
  margin: 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
  line-height: 20px;
}
.plans-cta {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}
.faq {
  border-radius: var(--ks-radius-card);
  overflow: hidden;
}
@media (min-width: 768px) and (max-width: 1023px) {
  .hero__inner {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 36px;
    padding: 56px 20px;
  }
  .hero__mock {
    order: -1;
  }
  .mock {
    transform: none;
  }
  .hero__title {
    font-size: 38px;
    line-height: 48px;
  }
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
  .steps {
    grid-template-columns: repeat(2, 1fr);
  }
  .plans-preview {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 767px) {
  .hero__inner {
    grid-template-columns: 1fr;
    min-height: 0;
    gap: 32px;
    padding: 44px 20px 56px;
  }
  .hero__mock {
    order: -1;
  }
  .mock {
    transform: none;
  }
  .hero__title {
    font-size: 32px;
    line-height: 42px;
  }
  .hero__ctas {
    flex-direction: column;
    align-items: stretch;
  }
  .btn {
    width: 100%;
  }
  .section {
    padding: 52px 0;
  }
  .features,
  .steps,
  .plans-preview {
    grid-template-columns: 1fr;
  }
}
</style>