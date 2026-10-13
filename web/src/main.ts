import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Vant from 'vant';
import 'vant/lib/index.css';
import './styles/tokens.css';
import App from './App.vue';
import { onUnauthorized } from './api/http';
import { router } from './router';
import { useAuthStore } from './stores/auth';
import { initTheme } from './lib/theme';
import { registerPermissionDirective } from './directives/permission';

const pinia = createPinia();

// Paint the stored theme before first render so there is no flash.
initTheme();

// 401 after a failed session refresh: drop local state and return to sign-in.
onUnauthorized(() => {
  const auth = useAuthStore(pinia);
  if (auth.isAuthenticated) {
    auth.clearSession();
    void router.push({ path: '/login' });
  }
});

const app = createApp(App);
app.use(pinia).use(router).use(Vant);
/* v-permission reads the organisation store, so pinia goes in first. */
registerPermissionDirective(app);
app.mount('#app');

void useAuthStore(pinia).bootstrap();
