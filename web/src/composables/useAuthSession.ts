import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import type { UserInfo } from '../types/user';
import { getUserByPhone, getUserByUserId, type UserByUserIdResult } from '../api/dingtalk-client';
import { clearGzdataToken, setAuthToken } from '../api/timesheet-client';
import { clearSessionCache, getLocalStorage, removeLocalStorage, setLocalStorage } from '../utils/cache';

const userId = shallowRef<string | null>(getLocalStorage('userId'));
const userInfo = shallowRef<UserInfo | null>(null);
const isLoading = shallowRef(false);

export function useAuthSession() {
  const router = useRouter();

  const isAuthenticated = computed(() => Boolean(userId.value && userInfo.value));

  function applyUserSession(data: UserByUserIdResult): boolean {
    if (!data.token) {
      return false;
    }

    setAuthToken(data.token);
    userId.value = data.userId;
    userInfo.value = {
      userId: data.userId,
      nickname: data.nickname || '未知',
      phone: data.phone || '',
      department: data.department || '未分配部门',
    };
    return true;
  }

  async function hydrateUser(targetUserId = userId.value): Promise<boolean> {
    if (!targetUserId) {
      return false;
    }

    isLoading.value = true;
    try {
      const response = await getUserByUserId(targetUserId);
      return response.data ? applyUserSession(response.data) : false;
    } catch {
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function hydrateUserByPhone(phone: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/[^\d]/g, '');
    if (!normalizedPhone) {
      return false;
    }

    isLoading.value = true;
    try {
      const response = await getUserByPhone(normalizedPhone);
      if (!response.data) {
        return false;
      }

      const ok = applyUserSession(response.data);
      if (ok) {
        storeUserId(response.data.userId);
      }
      return ok;
    } catch {
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function restoreAuth(): Promise<boolean> {
    if (!userId.value) {
      redirectToLogin('required');
      return false;
    }

    const ok = await hydrateUser(userId.value);
    if (!ok) {
      clearSession();
      redirectToLogin('required');
    }

    return ok;
  }

  function storeUserId(nextUserId: string): void {
    userId.value = nextUserId;
    setLocalStorage('userId', nextUserId);
  }

  function clearSession(): void {
    userId.value = null;
    userInfo.value = null;
    removeLocalStorage('userId');
    clearSessionCache();
    clearGzdataToken();
  }

  function redirectToLogin(reason: 'required' | 'expired' = 'required'): void {
    void router.push({
      name: 'dingtalk-login',
      query: {
        redirect: router.currentRoute.value.fullPath,
        reason,
      },
    });
  }

  function handleTokenExpired(): void {
    userInfo.value = null;
    clearGzdataToken();
    redirectToLogin('expired');
  }

  function logout(): void {
    clearSession();
    void router.push({ name: 'dingtalk-login' });
  }

  return {
    userId,
    userInfo,
    isLoading,
    isAuthenticated,
    hydrateUser,
    hydrateUserByPhone,
    restoreAuth,
    storeUserId,
    handleTokenExpired,
    logout,
  };
}
