<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { Channel, ChannelPlatform } from '../../types';
import ChannelStatusBadge from './ChannelStatusBadge.vue';

const props = defineProps<{ platform: ChannelPlatform; channel: Channel | null }>();

const emit = defineEmits<{
  (e: 'connect'): void;
  (e: 'disconnect'): void;
  (e: 'refresh'): void;
}>();

const i18n = useI18nStore();

const status = computed(() => props.channel?.status ?? 'disconnected');
const initials = computed(
  () => ({ whatsapp: 'W', facebook: 'f', instagram: 'Ig', tiktok: 'Tk' })[props.platform]
);
</script>

<template>
  <article class="channel-card" :class="`channel-card--${platform}`">
    <span class="channel-card__icon" aria-hidden="true">{{ initials }}</span>
    <div class="channel-card__info">
      <h3 class="channel-card__name">{{ i18n.t(`channels.platform.${platform}`) }}</h3>
      <p class="channel-card__account">{{ channel?.accountName ?? '—' }}</p>
    </div>
    <ChannelStatusBadge :status="status" />
    <div class="channel-card__actions">
      <button
        v-if="status === 'disconnected'"
        type="button"
        class="channel-card__btn channel-card__btn--primary"
        @click="emit('connect')"
      >{{ i18n.t('channels.connect') }}</button>
      <template v-else>
        <button
          type="button"
          class="channel-card__btn"
          @click="emit('refresh')"
        >{{ i18n.t('channels.refresh') }}</button>
        <button
          type="button"
          class="channel-card__btn channel-card__btn--danger"
          @click="emit('disconnect')"
        >{{ i18n.t('channels.disconnect') }}</button>
      </template>
    </div>
  </article>
</template>
<style scoped>
.channel-card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.channel-card__icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: Sora, sans-serif;
  font-weight: 800;
  font-size: 17px;
  color: #FFFFFF;
  flex-shrink: 0;
}
.channel-card--whatsapp .channel-card__icon {
  background: #25D366;
}
.channel-card--facebook .channel-card__icon {
  background: #1877F2;
}
.channel-card--instagram .channel-card__icon {
  background: linear-gradient(135deg, #F58529 0%, #DD2A7B 60%, #8134AF 100%);
}
.channel-card--tiktok .channel-card__icon {
  background: #010101;
}
.channel-card__info {
  flex: 1;
  min-width: 140px;
}
.channel-card__name {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.channel-card__account {
  margin: 2px 0 0;
  color: var(--ks-text-secondary);
  font-size: 13px;
}
.channel-card__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.channel-card__btn {
  height: 36px;
  padding: 0 16px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.channel-card__btn:hover {
  background: var(--ks-bg-muted);
}
.channel-card__btn--primary {
  border: none;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.channel-card__btn--primary:hover {
  filter: brightness(1.05);
  background: var(--ks-grad-brand);
}
.channel-card__btn--danger {
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--ks-error);
}
.channel-card__btn--danger:hover {
  background: rgba(220, 38, 38, 0.06);
}
@media (max-width: 600px) {
  .channel-card {
    padding: 14px 16px;
  }
  .channel-card__actions {
    width: 100%;
  }
  .channel-card__btn {
    flex: 1;
  }
}
</style>