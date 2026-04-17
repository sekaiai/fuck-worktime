import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import type { UserInfo } from '../types/user';
import { getUserByUserId } from '../api/dingtalk-client';
import { clearGzdataToken, setAuthToken } from '../api/timesheet-client';
import { getLocalStorage, removeLocalStorage, setLocalStorage, clearSessionCache } from '../utils/cache';

const userId = shallowRef<string | null>(getLocalStorage('userId'));
const userInfo = shallowRef<UserInfo | null>(null);
const isLoading = shallowRef(false);

export function useAuthSession() {
  const router = useRouter();

  const isAuthenticated = computed(() => Boolean(userId.value && userInfo.value));

  async function hydrateUser(targetUserId = userId.value): Promise<boolean> {
    if (!targetUserId) {
      return false;
    }

    isLoading.value = true;
    try {
      const response = await getUserByUserId(targetUserId);
      if (!response.data?.token) {
        return false;
      }

      setAuthToken(response.data.token);
      userId.value = response.data.userId;
      userInfo.value = {
        userId: response.data.userId,
        nickname: response.data.nickname || '未知',
        phone: response.data.phone || '',
        department: response.data.department || '未分配部门',
      };
      return true;
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
    restoreAuth,
    storeUserId,
    handleTokenExpired,
    logout,
  };
}
