import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Vant from 'vant';
import 'vant/lib/index.css';
import './styles/tokens.css';
import App from './App.vue';
import { onUnauthorized } from './api/http';
import { router } from './router';
import { useAuthStore } from './stores/auth';

const pinia = createPinia();

// 401 after a failed session refresh: drop local state and return to sign-in.
onUnauthorized(() => {
  const auth = useAuthStore(pinia);
  if (auth.isAuthenticated) {
    auth.clearSession();
    void router.push({ path: '/login' });
  }
});

createApp(App).use(pinia).use(router).use(Vant).mount('#app');

void useAuthStore(pinia).bootstrap();