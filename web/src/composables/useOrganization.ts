/**
 * Organisation management (Sprint 13).
 *
 * Owns the tenant lifecycle for the views: list, current, create, edit, delete,
 * switch, settings, overview and ownership transfer. Every read and write goes
 * through the organisation store so the demo/real switch and the tenant header
 * stay in one place; this composable adds nothing but a view-shaped facade.
 */
import { computed } from 'vue';
import {
  EMPTY_OVERVIEW,
  reloadAfterSwitch,
  useOrganizationStore
} from '../stores/organization';
import { confirmNameMatches, validateOrgInput } from '../lib/organization';
import type { ValidationErrors } from '../lib/settingsValidation';
import type {
  OrgActivity,
  OrgContext,
  OrgOverviewStats,
  Organization,
  OrganizationInput,
  OrganizationSettings,
  OrganizationSettingsInput
} from '../types';

export function useOrganization() {
  const store = useOrganizationStore();

  const organizations = computed(() => store.organizations);
  const currentOrganization = computed(() => store.currentOrganization);
  const currentOrgId = computed(() => store.currentOrgId);
  const overview = computed<OrgOverviewStats>(() => store.overview);
  const activity = computed<OrgActivity[]>(() => store.activity);
  const settings = computed<OrganizationSettings | null>(() => store.settings);
  const loading = computed(() => store.loading);
  const saving = computed(() => store.saving);
  const error = computed(() => store.error);
  const isOwner = computed(() => store.isOwner);
  const canManage = computed(() => store.canManage);
  const hasDemoData = computed(() => store.hasDemoData);
  /** True when the user belongs to no organisation and must be onboarded. */
  const needsOnboarding = computed(
    () => !store.loading && store.organizations.length === 0
  );
  /** More than one tenant means the switcher is worth showing. */
  const canSwitch = computed(() => store.organizations.length > 1);

  async function loadOrganizations(): Promise<Organization[]> {
    return store.fetchOrganizations();
  }

  async function loadCurrentOrganization(): Promise<Organization | null> {
    return store.fetchCurrentOrganization();
  }

  /** Resolves the tenant for a fresh session; safe to call repeatedly. */
  async function bootstrap(): Promise<void> {
    await store.bootstrap();
  }

  function validate(input: OrganizationInput): ValidationErrors {
    return validateOrgInput(input);
  }

  async function createOrganization(input: OrganizationInput): Promise<Organization | null> {
    if (Object.keys(validate(input)).length > 0) return null;
    return store.createOrganization(input);
  }

  async function updateOrganization(
    orgId: string,
    input: Partial<OrganizationInput>
  ): Promise<Organization | null> {
    return store.updateOrganization(orgId, input);
  }

  /**
   * Deleting an organisation requires typing its exact name. The guard runs here
   * rather than in the store so the store stays free of ui confirmation rules.
   */
  async function deleteOrganization(orgId: string, confirmName: string): Promise<boolean> {
    const target = store.organizations.find((org) => org.id === orgId);
    if (!target) return false;
    if (!confirmNameMatches(confirmName, target.name)) return false;
    return store.deleteOrganization(orgId);
  }

  async function switchOrganization(orgId: string): Promise<OrgContext | null> {
    return store.switchOrganization(orgId);
  }

  /** Switch, then hard-navigate so no cached row can survive the tenant change. */
  async function switchAndReload(orgId: string, route?: string): Promise<boolean> {
    const context = await store.switchOrganization(orgId);
    if (!context) return false;
    reloadAfterSwitch(route);
    return true;
  }

  async function loadOverview(orgId?: string): Promise<OrgOverviewStats> {
    return store.fetchOverview(orgId);
  }

  async function loadActivity(orgId?: string, limit = 10): Promise<OrgActivity[]> {
    return store.fetchActivity(orgId, limit);
  }

  async function loadSettings(orgId?: string): Promise<OrganizationSettings | null> {
    return store.fetchSettings(orgId);
  }

  async function saveSettings(
    input: OrganizationSettingsInput,
    orgId?: string
  ): Promise<OrganizationSettings | null> {
    return store.updateSettings(input, orgId);
  }

  async function transferOwnership(memberId: string, confirmName: string): Promise<Organization | null> {
    const target = store.currentOrganization;
    if (!target) return null;
    if (!confirmNameMatches(confirmName, target.name)) return null;
    return store.transferOwnership(memberId, target.id);
  }

  function emptyOverview(): OrgOverviewStats {
    return { ...EMPTY_OVERVIEW };
  }

  return {
    organizations,
    currentOrganization,
    currentOrgId,
    overview,
    activity,
    settings,
    loading,
    saving,
    error,
    isOwner,
    canManage,
    hasDemoData,
    needsOnboarding,
    canSwitch,
    bootstrap,
    loadOrganizations,
    loadCurrentOrganization,
    validate,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    switchOrganization,
    switchAndReload,
    loadOverview,
    loadActivity,
    loadSettings,
    saveSettings,
    transferOwnership,
    emptyOverview
  };
}
