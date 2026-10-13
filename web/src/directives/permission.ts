/**
 * v-permission directive (Sprint 13).
 *
 * Usage:
 *   <button v-permission="'customer:create'">New customer</button>
 *   <button v-permission:disable="'customer:delete'">Delete</button>
 *   <div v-permission="{ permissions: ['a:x', 'b:y'], mode: 'disable', all: true }">
 *
 * Two differences from PermissionGuard are deliberate. The guard does not render
 * its child at all, which is right for a whole section; the directive keeps the
 * element in the layout and hides or disables it, which is right for one control
 * among a row of controls, because a table that reshuffles when a right is missing
 * is harder to read than one with a greyed-out action.
 *
 * Checks are synchronous against the permission set the store cached at bootstrap.
 * That set arrives asynchronously, so each mounted element also watches it and
 * re-applies; without the watch a control would stay hidden until an unrelated
 * re-render happened to pass. The policy is fail-closed: no rights, no element.
 */
import { watch } from 'vue';
import type { App, Directive, DirectiveBinding, WatchStopHandle } from 'vue';
import { useOrganizationStore } from '../stores/organization';
import { hasAllPermissions, hasAnyPermission } from '../lib/permissions';

export type PermissionMode = 'hide' | 'disable';

export interface PermissionBindingValue {
  permission?: string;
  permissions?: string[];
  mode?: PermissionMode;
  /** True requires every listed right; false (default) requires any one. */
  all?: boolean;
  /** Shown as the title on a disabled element so the reason stays discoverable. */
  reason?: string;
}

export type PermissionValue = string | string[] | PermissionBindingValue;

export const PERMISSION_HIDDEN_ATTR = 'data-permission-hidden';
export const PERMISSION_DISABLED_CLASS = 'is-permission-disabled';
export const PERMISSION_REASON_ATTR = 'data-permission-reason';

const stopHandles = new WeakMap<HTMLElement, WatchStopHandle>();

export interface NormalizedPermission {
  keys: string[];
  mode: PermissionMode;
  all: boolean;
  reason?: string;
}

export function normalizePermission(
  binding: DirectiveBinding<PermissionValue>
): NormalizedPermission {
  const value = binding.value;
  let keys: string[] = [];
  let mode: PermissionMode = 'hide';
  let all = false;
  let reason: string | undefined;

  if (typeof value === 'string') {
    keys = [value];
  } else if (Array.isArray(value)) {
    keys = [...value];
  } else if (value && typeof value === 'object') {
    keys = value.permission ? [value.permission] : [...(value.permissions ?? [])];
    mode = value.mode === 'disable' ? 'disable' : 'hide';
    all = value.all === true;
    reason = value.reason;
  }

  /* Modifiers win over the defaults but not over an explicit object mode. */
  if (binding.modifiers?.disable) mode = 'disable';
  if (binding.modifiers?.all) all = true;

  return { keys, mode, all, reason };
}

/** Reads the cached rights; fails closed when no pinia is installed. */
export function readOwnedPermissions(): string[] | null {
  try {
    return [...useOrganizationStore().userPermissions];
  } catch {
    return null;
  }
}

export function isPermissionAllowed(keys: readonly string[], all: boolean): boolean {
  if (keys.length === 0) return true;
  const owned = readOwnedPermissions();
  if (owned === null) return false;
  return all ? hasAllPermissions(owned, keys) : hasAnyPermission(owned, keys);
}

/** Grants the element again once the right arrives. */
export function restoreElement(el: HTMLElement): void {
  const previous = el.getAttribute('data-permission-display');
  /* Only undo a display this module set itself. The mounted pass restores a
     permitted element before any deny has run, so clearing unconditionally
     would strip the inline display the template put on every allowed control. */
  if (previous !== null) {
    el.style.display = previous;
    el.removeAttribute('data-permission-display');
  }
  el.removeAttribute(PERMISSION_HIDDEN_ATTR);
  el.removeAttribute('aria-hidden');
  if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) el.disabled = false;
  el.removeAttribute('aria-disabled');
  el.classList.remove(PERMISSION_DISABLED_CLASS);
  el.style.pointerEvents = '';
  el.removeAttribute(PERMISSION_REASON_ATTR);
  el.removeAttribute('title');
}

export function denyElement(el: HTMLElement, mode: PermissionMode, reason?: string): void {
  if (mode === 'disable') {
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) el.disabled = true;
    el.setAttribute('aria-disabled', 'true');
    el.classList.add(PERMISSION_DISABLED_CLASS);
    el.style.pointerEvents = 'none';
    if (reason) {
      el.setAttribute(PERMISSION_REASON_ATTR, reason);
      el.setAttribute('title', reason);
    }
    return;
  }
  /* Hidden in place rather than removed: Vue owns the element's slot in the tree. */
  if (el.getAttribute('data-permission-display') === null) {
    el.setAttribute('data-permission-display', el.style.display);
  }
  el.style.display = 'none';
  el.setAttribute(PERMISSION_HIDDEN_ATTR, 'true');
  el.setAttribute('aria-hidden', 'true');
}

export function applyPermission(
  el: HTMLElement,
  binding: DirectiveBinding<PermissionValue>
): boolean {
  const { keys, mode, all, reason } = normalizePermission(binding);
  const allowed = isPermissionAllowed(keys, all);
  if (allowed) restoreElement(el);
  else denyElement(el, mode, reason);
  return allowed;
}

export const permissionDirective: Directive<HTMLElement, PermissionValue> = {
  mounted(el, binding) {
    applyPermission(el, binding);
    try {
      const store = useOrganizationStore();
      const stop = watch(
        () => store.userPermissions,
        () => applyPermission(el, binding)
      );
      stopHandles.set(el, stop);
    } catch {
      /* No reactive store in this host; the mounted pass is the whole story. */
    }
  },
  updated(el, binding) {
    applyPermission(el, binding);
  },
  unmounted(el) {
    stopHandles.get(el)?.();
    stopHandles.delete(el);
  }
};

/** Registers v-permission on an app; called once from main.ts. */
export function registerPermissionDirective(app: App): void {
  app.directive('permission', permissionDirective);
}
