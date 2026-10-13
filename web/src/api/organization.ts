/**
 * Organisation endpoints (Sprint 13).
 *
 * Same contract as every other api module: try the real backend first, fall back
 * to api/demoOrganization when the endpoint is missing, so the overview, the
 * settings page and the tenant switch all stay usable offline.
 *
 * Three calls are not in the spec's endpoint list but the spec's pages need them:
 * the overview page renders stats and a recent-activity feed (section 7) and the
 * settings page transfers ownership (section 10). They follow the same shape and
 * the same fallback, and are documented in the scan report.
 */
import { apiDelete, apiGet, apiPost, apiPut } from './http';
import { isMissingBackend } from './demo';
import {
  demoCreateOrganization,
  demoCurrentOrganization,
  demoDeleteOrganization,
  demoOrgActivity,
  demoOrganizations,
  demoOrganizationSettings,
  demoOverviewStats,
  demoSwitchOrganization,
  demoTransferOwnership,
  demoUpdateOrganization,
  demoUpdateOrganizationSettings
} from './demoOrganization';
import type {
  OrgActivity,
  OrgContext,
  OrgOverviewStats,
  Organization,
  OrganizationInput,
  OrganizationSettings,
  OrganizationSettingsInput
} from '../types';

const ORGANIZATIONS = '/api/v1/organizations';

function id(value: string): string {
  return encodeURIComponent(value);
}

export async function getOrganizations(): Promise<Organization[]> {
  try {
    return await apiGet<Organization[]>(ORGANIZATIONS);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoOrganizations();
  }
}

/** The tenant every other module reads its context from; null when there is none. */
export async function getCurrentOrganization(): Promise<Organization | null> {
  try {
    return await apiGet<Organization | null>(ORGANIZATIONS + '/current');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCurrentOrganization();
  }
}

export async function createOrganization(data: OrganizationInput): Promise<Organization> {
  try {
    return await apiPost<Organization>(ORGANIZATIONS, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateOrganization(data);
  }
}

export async function updateOrganization(
  orgId: string,
  data: Partial<OrganizationInput>
): Promise<Organization> {
  try {
    return await apiPut<Organization>(ORGANIZATIONS + '/' + id(orgId), data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateOrganization(orgId, data);
  }
}

export async function deleteOrganization(orgId: string): Promise<boolean> {
  try {
    return await apiDelete<boolean>(ORGANIZATIONS + '/' + id(orgId));
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoDeleteOrganization(orgId);
  }
}

export async function switchOrganization(orgId: string): Promise<OrgContext> {
  try {
    return await apiPost<OrgContext>(ORGANIZATIONS + '/' + id(orgId) + '/switch', {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoSwitchOrganization(orgId);
  }
}

export async function getOrganizationSettings(orgId: string): Promise<OrganizationSettings> {
  try {
    return await apiGet<OrganizationSettings>(ORGANIZATIONS + '/' + id(orgId) + '/settings');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoOrganizationSettings(orgId);
  }
}

export async function updateOrganizationSettings(
  orgId: string,
  data: OrganizationSettingsInput
): Promise<OrganizationSettings> {
  try {
    return await apiPut<OrganizationSettings>(
      ORGANIZATIONS + '/' + id(orgId) + '/settings',
      data
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoUpdateOrganizationSettings(orgId, data);
  }
}

/* ------------------------------------------- overview page support calls */

export async function getOrganizationOverview(orgId: string): Promise<OrgOverviewStats> {
  try {
    return await apiGet<OrgOverviewStats>(ORGANIZATIONS + '/' + id(orgId) + '/overview');
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoOverviewStats(orgId);
  }
}

export async function getOrganizationActivity(orgId: string, limit = 10): Promise<OrgActivity[]> {
  try {
    return await apiGet<OrgActivity[]>(
      ORGANIZATIONS + '/' + id(orgId) + '/activity?limit=' + limit
    );
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoOrgActivity(orgId, limit);
  }
}

export async function transferOwnership(orgId: string, memberId: string): Promise<Organization> {
  try {
    return await apiPost<Organization>(ORGANIZATIONS + '/' + id(orgId) + '/transfer', { memberId });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoTransferOwnership(orgId, memberId);
  }
}
