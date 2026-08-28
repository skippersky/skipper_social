import { createRouter, createWebHistory } from 'vue-router';
import DraftsView from '../views/DraftsView.vue';
import EditorView from '../views/EditorView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/editor' },
    { path: '/editor', name: 'editor', component: EditorView },
    { path: '/drafts', name: 'drafts', component: DraftsView }
  ]
});
