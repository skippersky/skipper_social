import { apiGet, ApiError } from './http';
import { demoPlans, isMissingBackend } from './demo';
import type { Plan } from '../types';

const PLANS = '/api/v1/plans';

export async function getPlans(): Promise<Plan[]> {
  try {
    return await apiGet<Plan[]>(PLANS);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoPlans();
  }
}

export async function getPlanById(id: string): Promise<Plan> {
  try {
    return await apiGet<Plan>(`${PLANS}/${id}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    const plan = demoPlans().find((p) => p.id === id);
    if (!plan) throw new ApiError('NOT_FOUND', 'plan not found');
    return plan;
  }
}