import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getUserByUserId } from '../api/dingtalk';
import { getLocalStorage, setLocalStorage, removeLocalStorage, clearAllCache } from '../utils/cache';
import { setGzdataToken, clearGzdataToken } from '../api/timesheet';
import type { UserInfo } from '../types/user';

const userId = ref<string | null>(getLocalStorage('userId'));
const userInfo = ref<UserInfo | null>(null);
const isLoading = ref(false);

export function useAuth() {
  const router = useRouter();

  const isAuthenticated = computed(() => !!userId.value && !!getLocalStorage('gzdata_token'));

  async function fetchUserInfo(): Promise<boolean> {
    if (!userId.value) return false;

    isLoading.value = true;
    try {
      const result = await getUserByUserId(userId.value);
      if (result.code === 200 && result.data) {
        userInfo.value = {
          userId: result.data.userId,
          nickname: result.data.nickname,
          phone: result.data.phone,
          deptName: result.data.department,
          avatar: '',
        };
        if (result.data.token) {
          setGzdataToken(result.data.token);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function restoreAuth(): Promise<boolean> {
    if (!userId.value) {
      redirectToLogin();
      return false;
    }

    const success = await fetchUserInfo();
    if (!success) {
      logout();
      return false;
    }
    return true;
  }

  function setUserId(id: string): void {
    userId.value = id;
    setLocalStorage('userId', id);
  }

  function redirectToLogin(): void {
    router.push('/dingtalk-login');
  }

  function logout(): void {
    userId.value = null;
    userInfo.value = null;
    removeLocalStorage('userId');
    clearGzdataToken();
    clearAllCache();
    redirectToLogin();
  }

  return {
    userId,
    userInfo,
    isLoading,
    isAuthenticated,
    fetchUserInfo,
    restoreAuth,
    setUserId,
    redirectToLogin,
    logout,
  };
}
