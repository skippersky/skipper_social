<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { showConfirmDialog, showToast } from 'vant';
import PasswordForm from '../../../components/settings/PasswordForm.vue';
import { useSecurity } from '../../../composables/useSecurity';
import { useI18nStore } from '../../../i18n';
import { relativeTime } from '../../../lib/relativeTime';
import { QR_PLACEHOLDER_SIZE } from '../../../lib/qrPlaceholder';
import type { PasswordChangeRequest } from '../../../types';

const i18n = useI18nStore();
const {
  devices,
  twoFactorEnabled,
  qrPending,
  qrMatrix,
  codeError,
  saving,
  loadSecuritySettings,
  changePassword,
  enableTwoFactor,
  disableTwoFactor,
  canRevoke,
  revokeDevice
} = useSecurity();

/** Enabling is a two step gesture: flip the switch, then prove the code. */
const codeVisible = ref(false);
const code = ref('');
const passwordForm = ref<InstanceType<typeof PasswordForm> | null>(null);

const qrCells = computed(() => qrMatrix.value);
const qrStyle = computed(() => ({
  gridTemplateColumns: 'repeat(' + QR_PLACEHOLDER_SIZE + ', 1fr)'
}));

function lastActiveLabel(timestamp: number): string {
  return relativeTime(timestamp, Date.now(), i18n.locale);
}

async function onPasswordSubmit(data: PasswordChangeRequest): Promise<void> {
  if (await changePassword(data)) {
    passwordForm.value?.reset();
    showToast(i18n.t('settings.passwordChanged'));
  } else {
    showToast(i18n.t('settings.passwordWrong'));
  }
}

async function onToggle(value: boolean): Promise<void> {
  if (value) {
    code.value = '';
    codeVisible.value = true;
    return;
  }
  codeVisible.value = false;
  if (await disableTwoFactor()) showToast(i18n.t('settings.tfaDisabled'));
  else showToast(i18n.t('settings.saveFailed'));
}

async function onConfirmCode(): Promise<void> {
  if (await enableTwoFactor(code.value)) {
    codeVisible.value = false;
    code.value = '';
    showToast(i18n.t('settings.tfaEnabled'));
  } else {
    showToast(i18n.t(codeError.value ?? 'settings.saveFailed'));
  }
}

async function onRevoke(deviceId: string, deviceName: string): Promise<void> {
  try {
    await showConfirmDialog({
      title: i18n.t('settings.devicesRevoke'),
      message: i18n.t('settings.devicesRevokeConfirm', { name: deviceName })
    });
  } catch {
    return;
  }
  if (await revokeDevice(deviceId)) showToast(i18n.t('settings.devicesRevoked'));
  else showToast(i18n.t('settings.saveFailed'));
}

onMounted(() => {
  void loadSecuritySettings();
});
</script>

<template>
  <div class="tab">
    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.passwordTitle') }}</h2>
      <p class="tab__hint">{{ i18n.t('settings.passwordHint') }}</p>
      <PasswordForm ref="passwordForm" :busy="saving" @submit="onPasswordSubmit" />
    </section>

    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.tfaTitle') }}</h2>
      <div class="row">
        <div class="row__copy">
          <p class="row__label">{{ i18n.t('settings.tfaEnable') }}</p>
          <p class="row__hint">{{ i18n.t('settings.tfaHint') }}</p>
        </div>
        <van-switch
          :model-value="twoFactorEnabled"
          size="22"
          @update:model-value="onToggle"
        />
      </div>

      <div v-if="codeVisible && !twoFactorEnabled" class="tfa-code">
        <label for="tfa-code">{{ i18n.t('settings.tfaCode') }}</label>
        <div class="tfa-code__row">
          <input
            id="tfa-code"
            v-model="code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
          />
          <button class="tab__btn tab__btn--primary" type="button" :disabled="saving" @click="onConfirmCode">
            {{ i18n.t('settings.tfaConfirm') }}
          </button>
        </div>
        <p v-if="codeError" class="field__error">{{ i18n.t(codeError) }}</p>
      </div>

      <div v-if="twoFactorEnabled" class="tfa-qr">
        <div class="tfa-qr__grid" :style="qrStyle" aria-hidden="true">
          <span
            v-for="(on, index) in qrCells"
            :key="'qr-' + index"
            class="tfa-qr__cell"
            :class="{ 'is-on': on }"
          ></span>
        </div>
        <div class="tfa-qr__copy">
          <p class="row__label">{{ i18n.t('settings.tfaEnabled') }}</p>
          <p v-if="qrPending" class="row__hint">{{ i18n.t('settings.tfaQrWaiting') }}</p>
          <p class="tab__notice">{{ i18n.t('settings.tfaDemoNotice') }}</p>
        </div>
      </div>
    </section>

    <section class="tab__card">
      <h2 class="tab__card-title">{{ i18n.t('settings.devicesTitle') }}</h2>
      <p class="tab__hint">{{ i18n.t('settings.devicesHint') }}</p>
      <p v-if="devices.length === 0" class="tab__empty">{{ i18n.t('settings.devicesEmpty') }}</p>
      <ul v-else class="devices">
        <li v-for="device in devices" :key="device.id" class="device">
          <div class="device__copy">
            <p class="device__name">
              {{ device.name }}
              <span v-if="device.current" class="device__badge">{{ i18n.t('settings.devicesCurrent') }}</span>
            </p>
            <p class="device__meta">
              {{ device.location }} &middot; {{ lastActiveLabel(device.lastActiveAt) }}
            </p>
          </div>
          <button
            v-if="canRevoke(device)"
            class="device__revoke"
            type="button"
            :disabled="saving"
            @click="onRevoke(device.id, device.name)"
          >{{ i18n.t('settings.devicesRevoke') }}</button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.tab__card {
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: var(--ks-radius-card);
  box-shadow: var(--ks-shadow-card);
  padding: 18px 20px;
}
.tab__card-title {
  margin: 0 0 6px;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--ks-text-primary);
}
.tab__hint {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.tab__notice {
  margin: 10px 0 0;
  padding: 8px 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid rgba(180, 83, 9, 0.35);
  background: rgba(180, 83, 9, 0.08);
  color: var(--ks-warning);
  font-size: 12px;
  line-height: 18px;
}
.tab__empty {
  margin: 0;
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: var(--ks-text-tertiary);
}
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-top: 1px solid var(--ks-border-default);
}
.row:first-of-type {
  border-top: none;
}
.row__copy {
  flex: 1;
  min-width: 0;
}
.row__label {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.row__hint {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--ks-text-tertiary);
}
.tfa-code {
  margin-top: 12px;
}
.tfa-code label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--ks-text-secondary);
  margin-bottom: 6px;
}
.tfa-code__row {
  display: flex;
  gap: 10px;
}
.tfa-code input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  border-radius: var(--ks-radius-btn);
  border: 1px solid var(--ks-border-strong);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 16px;
  letter-spacing: 6px;
}
.tfa-code input:focus-visible {
  outline: 2px solid var(--ks-primary-text);
  outline-offset: 0;
  border-color: transparent;
}
.tfa-qr {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--ks-border-default);
}
.tfa-qr__grid {
  width: 126px;
  height: 126px;
  flex-shrink: 0;
  display: grid;
  gap: 0;
  padding: 6px;
  background: var(--ks-bg-surface);
  border: 1px solid var(--ks-border-default);
  border-radius: 10px;
}
.tfa-qr__cell {
  background: transparent;
}
.tfa-qr__cell.is-on {
  background: var(--ks-text-primary);
}
.tfa-qr__copy {
  min-width: 0;
}
.field__error {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--ks-error);
}
.devices {
  list-style: none;
  margin: 0;
  padding: 0;
}
.device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ks-border-default);
}
.device:first-child {
  border-top: none;
}
.device__copy {
  flex: 1;
  min-width: 0;
}
.device__name {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ks-text-primary);
}
.device__badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(21, 128, 61, 0.1);
  color: var(--ks-success);
  font-size: 10px;
  font-weight: 700;
}
.device__meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ks-text-tertiary);
}
.device__revoke {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-error);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.device__revoke:hover {
  background: rgba(220, 38, 38, 0.06);
}
.device__revoke:disabled {
  opacity: 0.55;
  cursor: wait;
}
.tab__btn {
  height: 42px;
  padding: 0 18px;
  border: 1px solid var(--ks-border-strong);
  border-radius: var(--ks-radius-btn);
  background: var(--ks-bg-surface);
  color: var(--ks-text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.tab__btn--primary {
  border-color: transparent;
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
}
.tab__btn--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 767px) {
  .tfa-qr {
    flex-direction: column;
  }
  .tfa-code__row {
    flex-direction: column;
  }
  .tab__btn {
    width: 100%;
  }
}
</style>
