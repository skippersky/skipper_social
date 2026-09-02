import { apiDelete, apiGet, apiPost, apiPut } from './http';
import {
  demoCancel,
  demoChangePlan,
  demoCompleteCheckout,
  demoCreateCheckout,
  demoResume,
  isMissingBackend,
  readDemoSubscription
} from './demo';
import type { CheckoutSession, Subscription, SubscriptionTier } from '../types';

const SUBS = '/api/v1/subscriptions';

/** Returns a Stripe Checkout session URL (or the in-app demo checkout offline). */
export async function createSubscription(planId: SubscriptionTier): Promise<CheckoutSession> {
  try {
    return await apiPost<CheckoutSession>(SUBS, { planId });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCreateCheckout(planId);
  }
}

export async function getMySubscription(): Promise<Subscription> {
  try {
    return await apiGet<Subscription>(`${SUBS}/me`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return readDemoSubscription();
  }
}

export async function updateSubscription(subscriptionId: string, planId: SubscriptionTier): Promise<Subscription> {
  try {
    return await apiPut<Subscription>(`${SUBS}/${subscriptionId}`, { planId });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoChangePlan(planId);
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<Subscription> {
  try {
    return await apiDelete<Subscription>(`${SUBS}/${subscriptionId}`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoCancel();
  }
}

export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  try {
    return await apiPost<Subscription>(`${SUBS}/${subscriptionId}/resume`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    return demoResume();
  }
}

/** Demo checkout confirmation; real payments never flow through the client directly. */
export async function completeDemoCheckout(): Promise<Subscription> {
  return demoCompleteCheckout();
}