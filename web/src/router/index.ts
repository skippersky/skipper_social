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
import { useAuthStore } from '../stores/auth';

const PUBLIC_PATHS = new Set([
  '/',
  '/home',
  '/login',
  '/register',
  '/forgot-password',
  '/pricing',
  '/privacy',
  '/terms'
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
    { path: '/settings/security', name: 'settings-security', component: SettingsSecurityView }
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