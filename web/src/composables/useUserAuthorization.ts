import { onMounted, shallowRef } from 'vue';

import {
  type AuthorizedUserProfile,
  clearAuthorizedUser,
  fetchAuthorizedUser,
  saveAuthorizationToken,
} from '../api/user';

type SubmitStatus = 'idle' | 'success' | 'error';
const LOCAL_PHONE_KEY = 'authorized-user-phone';

export function useUserAuthorization() {
  const token = shallowRef('');
  const isSubmitting = shallowRef(false);
  const submitStatus = shallowRef<SubmitStatus>('idle');
  const statusMessage = shallowRef('填写 Token 后，系统会自动验证授权并保存用户信息。');
  const authorizedUser = shallowRef<AuthorizedUserProfile | null>(null);

  const submitToken = async () => {
    const trimmedToken = token.value.trim();

    if (!trimmedToken) {
      submitStatus.value = 'error';
      statusMessage.value = '请输入授权 Token。';
      return;
    }

    isSubmitting.value = true;

    try {
      const response = await saveAuthorizationToken(trimmedToken);

      if (!response.success || !response.data) {
        submitStatus.value = 'error';
        statusMessage.value = response.message || '授权失败。';
        return;
      }

      submitStatus.value = 'success';
      statusMessage.value = response.message || '授权成功';
      authorizedUser.value = response.data;
      token.value = '';
      window.localStorage.setItem(LOCAL_PHONE_KEY, response.data.phone);
    } catch (error) {
      submitStatus.value = 'error';
      statusMessage.value = error instanceof Error ? error.message : '授权失败。';
    } finally {
      isSubmitting.value = false;
    }
  };

  const clearAuth = async () => {
    const currentUser = authorizedUser.value;

    if (!currentUser) {
      return;
    }

    const confirmed = window.confirm(`确认清除 ${currentUser.phone} 的授权吗？`);

    if (!confirmed) {
      return;
    }

    isSubmitting.value = true;

    try {
      const response = await clearAuthorizedUser(currentUser.phone);

      if (!response.success) {
        submitStatus.value = 'error';
        statusMessage.value = response.message || '清除授权失败。';
        return;
      }

      authorizedUser.value = null;
      submitStatus.value = 'idle';
      statusMessage.value = '授权已清除，请重新填写 Token。';
      token.value = '';
      window.localStorage.removeItem(LOCAL_PHONE_KEY);
    } catch (error) {
      submitStatus.value = 'error';
      statusMessage.value = error instanceof Error ? error.message : '清除授权失败。';
    } finally {
      isSubmitting.value = false;
    }
  };

  onMounted(async () => {
    const phone = window.localStorage.getItem(LOCAL_PHONE_KEY)?.trim() ?? '';

    if (!phone) {
      return;
    }

    isSubmitting.value = true;

    try {
      const response = await fetchAuthorizedUser(phone);

      if (!response.success || !response.data) {
        window.localStorage.removeItem(LOCAL_PHONE_KEY);
        submitStatus.value = 'idle';
        statusMessage.value = '未找到本地手机号对应的授权信息，请重新授权。';
        return;
      }

      authorizedUser.value = response.data;
      submitStatus.value = response.data.status === 'expired' ? 'error' : 'success';
      statusMessage.value =
        response.data.status === 'expired'
          ? '当前授权已过期，请清除授权后重新填写 Token。'
          : '已通过本地手机号恢复授权用户信息。';
    } catch (error) {
      submitStatus.value = 'error';
      statusMessage.value = error instanceof Error ? error.message : '获取已授权用户信息失败。';
    } finally {
      isSubmitting.value = false;
    }
  });

  return {
    token,
    isSubmitting,
    submitStatus,
    statusMessage,
    authorizedUser,
    submitToken,
    clearAuth,
  };
}
