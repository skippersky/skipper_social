<script setup lang="ts">
/**
 * Invitation accept page (Sprint 13).
 *
 * Public by route, because the link arrives by email and is usually opened signed
 * out. That makes this page the one place in the module that has to render three
 * different doors: sign in first, the invitation itself, and the four ways an
 * invitation can be unusable (missing, expired, cancelled, already accepted). Each
 * dead end says which one it is rather than a bare "invalid link", because the
 * recipient cannot tell those apart and the sender is not in the room to explain.
 *
 * Accepting ends in switchAndReload: the new member's tenant is the invitation's
 * organisation, and a hard navigation is how the store guarantees no cached row
 * from the previous tenant follows them in.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showToast } from 'vant';
import KsAvatar from '../../components/KsAvatar.vue';
import RoleBadge from '../../components/permission/RoleBadge.vue';
import { usePageMeta } from '../../composables/usePageMeta';
import { useMember } from '../../composables/useMember';
import { useOrganization } from '../../composables/useOrganization';
import { useAuthStore } from '../../stores/auth';
import { useI18nStore } from '../../i18n';
import type { InvitationPreview } from '../../types';

const i18n = useI18nStore();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

usePageMeta(i18n.t('org.invitation.metaTitle'), i18n.t('org.invitation.metaDescription'));

const { loadInvitationPreview, acceptInvitation } = useMember();
const { switchAndReload } = useOrganization();

const preview = ref<InvitationPreview | null>(null);
const loading = ref(true);
const accepting = ref(false);
const error = ref<string | null>(null);

const token = computed(() => {
  const raw = route.params.token;
  return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
});

/** An unusable invitation gets its own message instead of a generic failure. */
const blockReason = computed<string | null>(() => {
  const invite = preview.value;
  if (!invite) return error.value ?? 'org.invitation.notFound';
  if (invite.status === 'expired') return 'org.invitation.expired';
  if (invite.status === 'cancelled') return 'org.invitation.cancelled';
  if (invite.status === 'accepted') return 'org.invitation.alreadyAccepted';
  return null;
});

const usable = computed(() => blockReason.value === null && preview.value !== null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    preview.value = await loadInvitationPreview(token.value);
  } catch {
    preview.value = null;
    error.value = 'org.invitation.notFound';
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onAccept(): Promise<void> {
  accepting.value = true;
  const member = await acceptInvitation(token.value);
  accepting.value = false;
  if (!member) {
    error.value = 'org.invitation.notFound';
    return;
  }
  showToast(i18n.t('org.invitation.acceptedToast'));
  /* Land inside the organisation just joined, with every cache dropped. */
  const switched = await switchAndReload(member.orgId, '/dashboard/organization');
  if (!switched) void router.push('/dashboard/organization/switch');
}

function onDecline(): void {
  showToast(i18n.t('org.invitation.declinedToast'));
  void router.push(auth.isAuthenticated ? '/home' : '/');
}

function goSignIn(path: '/login' | '/register'): void {
  void router.push({ path, query: { redirect: route.fullPath } });
}

defineExpose({ preview, loading, accepting, error, blockReason, usable, token, load, onAccept, onDecline });
</script>

<template>
  <div class="iv">
    <main class="iv__card" data-testid="invitation-card">
      <h1 class="iv__title">{{ i18n.t('org.invitation.title') }}</h1>

      <p v-if="loading" class="iv__muted" data-testid="invitation-loading">{{ i18n.t('common.loading') }}</p>

      <template v-else-if="!auth.isAuthenticated">
        <p class="iv__text" data-testid="invitation-signin">{{ i18n.t('org.invitation.signInFirst') }}</p>
        <div v-if="preview" class="iv__summary">
          <KsAvatar :name="preview.orgName" :src="preview.orgLogoUrl" :size="44" />
          <div>
            <p class="iv__org">{{ preview.orgName }}</p>
            <p class="iv__meta">{{ i18n.t('org.invitation.invitedBy', { name: preview.inviterName }) }}</p>
          </div>
        </div>
        <div class="iv__actions">
          <button class="iv__btn iv__btn--primary" type="button" data-testid="invitation-login" @click="goSignIn('/login')">
            {{ i18n.t('org.invitation.login') }}
          </button>
          <button class="iv__btn" type="button" data-testid="invitation-register" @click="goSignIn('/register')">
            {{ i18n.t('org.invitation.register') }}
          </button>
        </div>
      </template>

      <template v-else-if="blockReason">
        <p class="iv__blocked" role="alert" data-testid="invitation-blocked">{{ i18n.t(blockReason) }}</p>
        <div class="iv__actions">
          <button class="iv__btn" type="button" data-testid="invitation-home" @click="onDecline">
            {{ i18n.t('org.forbidden.goHome') }}
          </button>
        </div>
      </template>

      <template v-else-if="usable && preview">
        <div class="iv__summary">
          <KsAvatar :name="preview.orgName" :src="preview.orgLogoUrl" :size="52" />
          <div class="iv__summary-copy">
            <p class="iv__label">{{ i18n.t('org.invitation.orgLabel') }}</p>
            <p class="iv__org">{{ preview.orgName }}</p>
          </div>
        </div>
        <dl class="iv__grid">
          <div>
            <dt>{{ i18n.t('org.invitation.invitedBy') }}</dt>
            <dd>{{ preview.inviterName }}</dd>
          </div>
          <div>
            <dt>{{ i18n.t('org.invitation.roleLabel') }}</dt>
            <dd><RoleBadge :kind="preview.roleKind" :label="preview.roleName" size="sm" /></dd>
          </div>
          <div>
            <dt>{{ i18n.t('org.invitation.emailLabel') }}</dt>
            <dd>{{ preview.email }}</dd>
          </div>
        </dl>
        <div class="iv__actions">
          <button
            class="iv__btn iv__btn--primary"
            type="button"
            :disabled="accepting"
            data-testid="invitation-accept"
            @click="onAccept"
          >{{ i18n.t('org.invitation.accept') }}</button>
          <button class="iv__btn" type="button" :disabled="accepting" data-testid="invitation-decline" @click="onDecline">
            {{ i18n.t('org.invitation.decline') }}
          </button>
        </div>
      </template>
    </main>
  </div>
</template>

<style scoped>
.iv {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  background: var(--ks-bg-page);
}
.iv__card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 480px;
  padding: 28px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  background: var(--ks-bg-surface);
  box-shadow: var(--ks-shadow-card);
}
.iv__title {
  margin: 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 21px;
  line-height: 29px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.iv__text,
.iv__muted {
  margin: 0;
  font-size: 14px;
  line-height: 21px;
  color: var(--ks-text-secondary);
}
.iv__blocked {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid rgba(180, 83, 9, 0.26);
  border-radius: var(--ks-radius-btn);
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 13px;
  line-height: 20px;
}
.iv__summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-grad-soft);
}
.iv__summary-copy {
  min-width: 0;
}
.iv__label {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ks-text-tertiary);
}
.iv__org {
  margin: 4px 0 0;
  font-family: Sora, "PingFang SC", sans-serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--ks-text-primary);
  overflow-wrap: anywhere;
}
.iv__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.iv__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}
.iv__grid dt {
  font-size: 11px;
  color: var(--ks-text-tertiary);
}
.iv__grid dd {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ks-text-primary);
  overflow-wrap: anywhere;
}
.iv__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.iv__btn {
  flex: 1 1 140px;
  height: 42px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ks-motion-fast) var(--ks-ease);
}
.iv__btn:hover:not(:disabled) {
  background: var(--ks-bg-muted);
}
.iv__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.iv__btn:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 1px;
}
.iv__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
@media (max-width: 767px) {
  .iv {
    padding: 24px 14px;
  }
  .iv__card {
    padding: 20px;
  }
  .iv__grid {
    grid-template-columns: 1fr;
  }
}
</style>
