import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeShellView.vue'),
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('../views/PushNotificationsView.vue'),
  },
  {
    path: '/dingtalk-login',
    name: 'dingtalk-login',
    component: () => import('../views/DingtalkAuthView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
