import { createRouter, createWebHistory } from 'vue-router';
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router';

import { getLocalStorage } from '../utils/cache';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeShellView.vue'),
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('../views/PushNotificationsView.vue'),
    meta: {
      requiresAuth: true,
    },
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

router.beforeEach((to: RouteLocationNormalized) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const userId = getLocalStorage('userId');
  if (userId) {
    return true;
  }

  return {
    name: 'dingtalk-login',
    query: {
      redirect: to.fullPath,
      reason: 'required',
    },
  };
});

export default router;
