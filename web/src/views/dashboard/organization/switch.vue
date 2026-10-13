<script setup lang="ts">
/**
 * Switch organisation (Sprint 13).
 *
 * A card per tenant with the role the signed-in user holds in it, because "switch"
 * only makes sense once you can see what you would become on the other side. The
 * switch itself is switchAndReload: the store clears the org-scoped caches and then
 * the browser does a hard navigation, which is the only way to be sure no store
 * without a reset entry point keeps a row from the previous tenant alive.
 */
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { showToast } from 'vant';
import OrgCard from '../../../components/organization/OrgCard.vue';
import OrgPageShell from '../../../components/organization/OrgPageShell.vue';
import { useOrganization } from '../../../composables/useOrganization';
import { useI18nStore } from '../../../i18n';

const i18n = useI18nStore();
const router = useRouter();

const {
  organizations,
  currentOrgId,
  loading,
  saving,
  error,
  hasDemoData,
  loadOrganizations,
  loadCurrentOrganization,
  switchAndReload
} = useOrganization();

const switchable = computed(() => organizations.value.filter((org) => org.id !== currentOrgId.value));

async function load(): Promise<void> {
  /* Both, so the page can mark the tenant already in use. The route guard has
     normally bootstrapped it, but a deep link or a failed current-org read would
     otherwise leave every card looking switchable, including this one. */
  await Promise.all([loadOrganizations(), loadCurrentOrganization()]);
}

onMounted(load);

async function onSwitch(orgId: string): Promise<void> {
  if (orgId === currentOrgId.value) return;
  const done = await switchAndReload(orgId);
  /* switchAndReload hard-navigates on success, so this only runs on failure. */
  if (!done) showToast(i18n.t('org.switch.failedToast'));
}

function createOrg(): void {
  void router.push('/onboarding/create-org');
}

defineExpose({ switchable, load, onSwitch, createOrg });
</script>

<template>
  <OrgPageShell
    :title="i18n.t('org.switch.title')"
    :subtitle="i18n.t('org.switch.subtitle')"
    active="switch"
    :demo="hasDemoData"
    :error="error"
    :loading="loading"
    @retry="load"
  >
    <template #actions>
      <button class="sw__btn sw__btn--primary" type="button" data-testid="switch-create" @click="createOrg">
        {{ i18n.t('org.switch.create') }}
      </button>
    </template>

    <p v-if="organizations.length === 0" class="sw__empty" data-testid="switch-empty">
      {{ i18n.t('org.switch.empty') }}
    </p>
    <div v-else class="sw__grid" data-testid="switch-grid">
      <OrgCard
        v-for="org in organizations"
        :key="org.id"
        :organization="org"
        :active="org.id === currentOrgId"
        :selectable="!saving && org.id !== currentOrgId"
        data-testid="switch-card"
        @select="onSwitch"
      />
    </div>
    <p v-if="saving" class="sw__busy" data-testid="switch-busy">{{ i18n.t('org.switch.switching') }}</p>
  </OrgPageShell>
</template>

<style scoped>
.sw__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.sw__empty,
.sw__busy {
  margin: 0;
  padding: 24px;
  border: 1px dashed var(--ks-border-strong);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  font-size: 14px;
  color: var(--ks-text-secondary);
  text-align: center;
}
.sw__busy {
  border-style: solid;
  color: var(--ks-text-tertiary);
}
.sw__btn {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.sw__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.sw__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
@media (max-width: 1023px) {
  .sw__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 767px) {
  .sw__grid {
    grid-template-columns: 1fr;
  }
}
</style>
