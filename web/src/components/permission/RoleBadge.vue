<script setup lang="ts">
/**
 * RoleBadge (Sprint 13).
 *
 * One visual language for the four built-in kinds plus custom roles, used in the
 * member table, the role grid, the switcher and the invite dialog so a role reads
 * the same everywhere. Colours come from the design tokens only: owner carries the
 * brand gradient, the others a tint of an existing token, which keeps the badge
 * inside the palette without inventing new hues.
 */
import { computed } from 'vue';
import { useI18nStore } from '../../i18n';
import type { OrgRoleKind } from '../../types';

const props = withDefaults(
  defineProps<{
    kind: OrgRoleKind;
    /** Overrides the kind label, e.g. a custom role's own name. */
    label?: string;
    size?: 'sm' | 'md';
  }>(),
  { label: undefined, size: 'md' }
);

const i18n = useI18nStore();

const text = computed(() => props.label ?? i18n.t('org.role.' + props.kind));

const ownerIcon = computed(() => (props.kind === 'owner' ? i18n.t('org.roleIcon.owner') : ''));
</script>

<template>
  <span
    class="rb"
    :class="['rb--' + kind, 'rb--' + size]"
    :data-role-kind="kind"
    :title="text"
  >
    <span v-if="ownerIcon" class="rb__icon" aria-hidden="true">{{ ownerIcon }}</span>
    {{ text }}
  </span>
</template>

<style scoped>
.rb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 600;
  white-space: nowrap;
  line-height: 1;
}
.rb--md {
  padding: 5px 10px;
  font-size: 12px;
}
.rb--sm {
  padding: 3px 8px;
  font-size: 11px;
}
.rb__icon {
  font-size: 0.9em;
}
.rb--owner {
  background: var(--ks-grad-brand);
  color: var(--ks-ink-on-grad);
  border-color: transparent;
}
.rb--admin {
  background: rgba(91, 91, 214, 0.12);
  color: var(--ks-accent);
  border-color: rgba(91, 91, 214, 0.28);
}
.rb--member {
  background: rgba(244, 99, 58, 0.1);
  color: var(--ks-primary-text);
  border-color: rgba(244, 99, 58, 0.26);
}
.rb--viewer {
  background: var(--ks-bg-muted);
  color: var(--ks-text-secondary);
  border-color: var(--ks-border-strong);
}
.rb--custom {
  background: rgba(21, 128, 61, 0.1);
  color: var(--ks-success);
  border-color: rgba(21, 128, 61, 0.26);
}
</style>
