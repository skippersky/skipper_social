<script setup lang="ts">
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import { CHANNEL_PLATFORMS, type ChannelPlatform } from '../../types';

defineProps<{ show: boolean }>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'select', platform: ChannelPlatform): void;
}>();

const i18n = useI18nStore();

const actions = computed(() =>
  CHANNEL_PLATFORMS.map((platform) => ({
    name: i18n.t(`channels.platform.${platform}`),
    platform
  }))
);

function onSelect(action: { platform: ChannelPlatform }): void {
  emit('select', action.platform);
  emit('update:show', false);
}
</script>

<template>
  <van-action-sheet
    :show="show"
    :actions="actions"
    :title="i18n.t('channels.selectPlatform')"
    cancel-text=" "
    close-on-click-action
    @select="onSelect"
    @update:show="(value: boolean) => emit('update:show', value)"
  />
</template>