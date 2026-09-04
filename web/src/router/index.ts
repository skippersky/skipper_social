import { createRouter, createWebHistory } from 'vue-router';
import ChatView from '../views/ChatView.vue';
import DraftsView from '../views/DraftsView.vue';
import EditorView from '../views/EditorView.vue';
import ForgotPasswordView from '../views/ForgotPasswordView.vue';
import HomeView from '../views/HomeView.vue';
import LandingLayout from '../layouts/LandingLayout.vue';
import LandingIndex from '../views/landing/index.vue';
import LandingPricing from '../views/landing/pricing.vue';
import LandingPrivacy from '../views/landing/privacy.vue';
import LandingTerms from '../views/landing/terms.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';
import SettingsProfileView from '../views/SettingsProfileView.vue';
import SettingsSecurityView from '../views/SettingsSecurityView.vue';
import SubscriptionView from '../views/dashboard/subscription/index.vue';
import SubscriptionUpgradeView from '../views/dashboard/subscription/upgrade.vue';
import SubscriptionUsageView from '../views/dashboard/subscription/usage.vue';
import CheckoutSuccessView from '../views/checkout/success.vue';
import CheckoutCancelView from '../views/checkout/cancel.vue';
import CheckoutDemoView from '../views/checkout/demo.vue';
import ConversationsView from '../views/dashboard/conversations/index.vue';
import ChannelsView from '../views/dashboard/channels/index.vue';
import ChannelConnectView from '../views/dashboard/channels/connect.vue';
import AuthCallbackView from '../views/auth/callback.vue';
import { useAuthStore } from '../stores/auth';

const PUBLIC_PATHS = new Set([
  '/',
  '/home',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
  '/privacy',
  '/terms',
  '/checkout/success',
  '/checkout/cancel',
  '/auth/callback/whatsapp',
  '/auth/callback/facebook',
  '/auth/callback/instagram',
  '/auth/callback/tiktok'
]);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LandingLayout,
      children: [
        { path: '', name: 'landing', component: LandingIndex },
        { path: 'pricing', name: 'pricing', component: LandingPricing },
        { path: 'privacy', name: 'privacy', component: LandingPrivacy },
        { path: 'terms', name: 'terms', component: LandingTerms }
      ]
    },
    { path: '/home', name: 'home', component: HomeView },
    { path: '/editor', name: 'editor', component: EditorView },
    { path: '/drafts', name: 'drafts', component: DraftsView },
    { path: '/chat', name: 'chat', component: ChatView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
    { path: '/settings', redirect: '/settings/profile' },
    { path: '/settings/profile', name: 'settings-profile', component: SettingsProfileView },
    { path: '/settings/security', name: 'settings-security', component: SettingsSecurityView },
    { path: '/dashboard/subscription', name: 'subscription', component: SubscriptionView },
    { path: '/dashboard/subscription/upgrade', name: 'subscription-upgrade', component: SubscriptionUpgradeView },
    { path: '/dashboard/subscription/usage', name: 'subscription-usage', component: SubscriptionUsageView },
    { path: '/checkout/demo', name: 'checkout-demo', component: CheckoutDemoView },
    { path: '/checkout/success', name: 'checkout-success', component: CheckoutSuccessView },
    { path: '/checkout/cancel', name: 'checkout-cancel', component: CheckoutCancelView },
    { path: '/dashboard/conversations', name: 'conversations', component: ConversationsView },
    { path: '/dashboard/channels', name: 'channels', component: ChannelsView },
    { path: '/dashboard/channels/connect/:platform', name: 'channel-connect', component: ChannelConnectView },
    { path: '/auth/callback/:platform', name: 'auth-callback', component: AuthCallbackView }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.bootstrap();
  if (!PUBLIC_PATHS.has(to.path) && !auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  if ((to.path === '/login' || to.path === '/register') && auth.isAuthenticated) {
    return { path: '/chat' };
  }
  return true;
});