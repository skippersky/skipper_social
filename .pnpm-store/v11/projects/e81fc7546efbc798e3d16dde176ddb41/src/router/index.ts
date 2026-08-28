import { createRouter, createWebHistory } from 'vue-router';
import ChatView from '../views/ChatView.vue';
import DraftsView from '../views/DraftsView.vue';
import EditorView from '../views/EditorView.vue';
import HomeView from '../views/HomeView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/editor', name: 'editor', component: EditorView },
    { path: '/drafts', name: 'drafts', component: DraftsView },
    { path: '/chat', name: 'chat', component: ChatView }
  ]
});