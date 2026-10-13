<script setup lang="ts">
/**
 * PermissionGuard (Sprint 13).
 *
 * Renders the default slot only when the check passes, so a whole section can be
 * withheld instead of greyed out. The fallback slot is what a page shows in its
 * place, typically one "ask your administrator" line, which beats an unexplained
 * hole in the layout.
 *
 * The check reads the store's cached permission set, so it is synchronous and
 * reactive: when that set arrives after bootstrap the guard re-renders by itself.
 */
import { computed } from 'vue';
import { useOrganizationStore } from '../../stores/organization';
import { hasAllPermissions, hasAnyPermission } from '../../lib/permissions';

const props = withDefaults(
  defineProps<{
    /** Single right, e.g. 'customer:delete'. */
    permission?: string;
    /** Several rights, combined according to mode. */
    permissions?: string[];
    /** 'any' (default) needs one match; 'all' needs every one. */
    mode?: 'any' | 'all';
  }>(),
  { permission: undefined, permissions: undefined, mode: 'any' }
);

const store = useOrganizationStore();

const keys = computed<string[]>(() => {
  if (props.permission) return [props.permission];
  return props.permissions ? [...props.permissions] : [];
});

const allowed = computed<boolean>(() => {
  /* An empty check means "no restriction", never "deny everything". */
  if (keys.value.length === 0) return true;
  return props.mode === 'all'
    ? hasAllPermissions(store.userPermissions, keys.value)
    : hasAnyPermission(store.userPermissions, keys.value);
});

defineExpose({ allowed, keys });
</script>

<template>
  <slot v-if="allowed" />
  <slot v-else-if="$slots.fallback" name="fallback" />
</template>
