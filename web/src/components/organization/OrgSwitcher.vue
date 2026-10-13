<script setup lang="ts">
/**
 * OrgSwitcher (Sprint 13).
 *
 * The tenant control in the top bar: the active organisation, the list the user
 * belongs to, and the two ways out - switch, or create another one. It hides
 * itself for a signed-out visitor, and for a signed-in user with a single
 * organisation it still renders, because "which workspace am I in" is a question
 * worth answering on screen rather than leaving implicit.
 *
 * Switching delegates to the composable, which reloads the app so no cached row
 * from the previous tenant can survive. autoReload exists so a test can assert the
 * switch without jsdom navigation.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import KsAvatar from '../KsAvatar.vue';
import { useI18nStore } from '../../i18n';
import { useAuthStore } from '../../stores/auth';
import { useOrganization } from '../../composables/useOrganization';
import { orgInitials } from '../../lib/organization';
import type { Organization } from '../../types';

const props = withDefaults(defineProps<{ autoReload?: boolean }>(), { autoReload: true });

const emit = defineEmits<{ (event: 'switched', orgId: string): void }>();

const i18n = useI18nStore();
const auth = useAuthStore();
const router = useRouter();
const { organizations, currentOrganization, switchOrganization, switchAndReload } = useOrganization();

const open = ref(false);
const busy = ref(false);
const root = ref<HTMLElement | null>(null);

const visible = computed(() => auth.isAuthenticated);
const initials = computed(() =>
  currentOrganization.value ? orgInitials(currentOrganization.value.name) : '?'
);
const currentName = computed(
  () => currentOrganization.value?.name ?? i18n.t('org.switch.empty')
);
const others = computed(() =>
  organizations.value.filter((org) => org.id !== currentOrganization.value?.id)
);

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (root.value && target && !root.value.contains(target)) close();
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});

async function onSwitch(orgId: string): Promise<void> {
  if (busy.value) return;
  const target = organizations.value.find((org) => org.id === orgId);
  busy.value = true;
  try {
    if (props.autoReload) {
      const ok = await switchAndReload(orgId);
      if (!ok) showToast(i18n.t('org.switch.failedToast'));
      return;
    }
    const context = await switchOrganization(orgId);
    if (context) {
      showToast(i18n.t('org.switch.successToast', { name: target?.name ?? context.orgName }));
      emit('switched', orgId);
    } else {
      showToast(i18n.t('org.switch.failedToast'));
    }
  } finally {
    busy.value = false;
    close();
  }
}

function onCreate(): void {
  close();
  void router.push('/onboarding/create-org');
}

function onManage(): void {
  close();
  void router.push('/dashboard/organization');
}

defineExpose({ open, close, onSwitch, organizations: organizations as unknown as Organization[] });
</script>

<template>
  <div v-if="visible" ref="root" class="os" data-testid="org-switcher">
    <button
      class="os__trigger"
      type="button"
      :aria-label="i18n.t('org.switch.title')"
      aria-haspopup="menu"
      :aria-expanded="open"
      data-testid="org-switcher-trigger"
      @click="toggle"
    >
      <KsAvatar :name="initials" :src="currentOrganization?.logoUrl" :size="26" />
      <span class="os__name">{{ currentName }}</span>
      <span class="os__caret" aria-hidden="true">&#9662;</span>
    </button>

    <div v-if="open" class="os__panel" role="menu" data-testid="org-switcher-panel">
      <p class="os__heading">{{ i18n.t('org.switch.title') }}</p>
      <button
        v-for="org in organizations"
        :key="org.id"
        class="os__item"
        :class="{ 'is-current': org.id === currentOrganization?.id }"
        type="button"
        role="menuitem"
        :data-org-id="org.id"
        :disabled="busy || org.id === currentOrganization?.id"
        @click="onSwitch(org.id)"
      >
        <KsAvatar :name="orgInitials(org.name)" :src="org.logoUrl" :size="24" />
        <span class="os__item-name">{{ org.name }}</span>
        <span v-if="org.id === currentOrganization?.id" class="os__tick" aria-hidden="true">&#10003;</span>
      </button>

      <div class="os__sep" role="separator"></div>
      <button class="os__action" type="button" role="menuitem" data-testid="org-switcher-create" @click="onCreate">
        {{ i18n.t('org.switch.create') }}
      </button>
      <button class="os__action" type="button" role="menuitem" @click="onManage">
        {{ i18n.t('org.action.settings') }}
      </button>
      <p v-if="others.length === 0" class="os__hint">{{ i18n.t('org.switch.subtitle') }}</p>
    </div>
  </div>
</template>

<style scoped>
.os {
  position: relative;
}
.os__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px 0 4px;
  border: 1px solid var(--ks-border-default);
  border-radius: 999px;
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--ks-motion-fast) var(--ks-ease);
}
.os__trigger:hover {
  border-color: var(--ks-border-strong);
}
.os__trigger:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 2px;
}
.os__name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.os__caret {
  font-size: 9px;
  color: var(--ks-text-tertiary);
}
.os__panel {
  position: absolute;
  right: 0;
  top: 42px;
  z-index: 130;
  min-width: 240px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-float);
}
.os__heading {
  margin: 0 0 6px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.os__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.os__item:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.os__item.is-current {
  background: var(--ks-grad-soft);
  font-weight: 600;
}
.os__item:disabled {
  cursor: default;
}
.os__item-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.os__tick {
  color: var(--ks-primary-text);
  font-size: 12px;
}
.os__sep {
  height: 1px;
  margin: 6px 0;
  background: var(--ks-border-default);
}
.os__action {
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--ks-primary-text);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.os__action:hover {
  background: var(--ks-bg-muted);
}
.os__hint {
  margin: 6px 0 0;
  padding: 0 8px;
  font-size: 11px;
  line-height: 16px;
  color: var(--ks-text-tertiary);
}
@media (max-width: 767px) {
  .os__name {
    max-width: 96px;
  }
}
</style>
