<script setup lang="ts">
</script>

<template>
  <div class="home">
    <div class="home__kente" aria-hidden="true"></div>
    <main class="home__inner">
      <p class="home__overline">Kilisocial · 社交内容工作台</p>
      <h1 class="home__title">把每条客户消息，<br />变成一次成交机会</h1>
      <p class="home__subtitle">WhatsApp 会话 × AI 文案 × 多平台发布，为东非市场而生。</p>

      <div class="home__cta">
        <router-link to="/chat" class="home__cta-link">
          <van-button type="primary" size="large" block>进入会话</van-button>
        </router-link>
      </div>

      <div class="home__entries">
        <router-link class="entry" to="/editor">
          <span class="entry__title">AI 文案工作台</span>
          <span class="entry__desc">斯瓦希里语 / 英语文案生成，离线草稿</span>
        </router-link>
        <router-link class="entry" to="/drafts">
          <span class="entry__title">草稿箱</span>
          <span class="entry__desc">本地保存，断网随时可用</span>
        </router-link>
      </div>

      <p class="home__notice">第三方平台账号审核中，发布功能稍后开放</p>
    </main>
  </div>
</template>

<style scoped>
.home {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background:
    repeating-linear-gradient(45deg, rgba(217, 179, 108, 0.03) 0 2px, transparent 2px 14px),
    repeating-linear-gradient(-45deg, rgba(217, 179, 108, 0.02) 0 2px, transparent 2px 14px),
    var(--ks-bg-base);
}
.home__kente {
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--ks-primary) 0 33.3%,
    var(--ks-ochre) 33.3% 66.6%,
    var(--ks-sand) 66.6% 100%
  );
}
.home__inner {
  flex: 1;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 72px 24px 48px;
  display: flex;
  flex-direction: column;
}
.home__overline {
  margin: 0 0 16px;
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ks-sand);
}
.home__title {
  font-size: 28px;
  line-height: 36px;
  font-weight: 700;
}
.home__subtitle {
  margin: 16px 0 32px;
  font-size: 16px;
  line-height: 24px;
  color: var(--ks-text-secondary);
}
.home__cta {
  margin-bottom: 32px;
}
.home__cta-link {
  display: block;
  max-width: 320px;
  text-decoration: none;
}
.home__entries {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border-radius: var(--ks-radius-card);
  border: 1px solid var(--ks-border-default);
  background: var(--ks-bg-surface);
  text-decoration: none;
  transition: border-color var(--ks-motion-fast) var(--ks-ease),
    transform var(--ks-motion-fast) var(--ks-ease);
}
.entry:hover {
  border-color: var(--ks-border-hover);
  transform: translateY(-1px);
}
.entry__title {
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.entry__desc {
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.home__notice {
  margin: 40px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-warning);
}
@media (max-width: 767px) {
  .home__inner {
    padding-top: 48px;
  }
  .home__title {
    font-size: 24px;
    line-height: 32px;
  }
  .home__entries {
    grid-template-columns: 1fr;
  }
}
</style>